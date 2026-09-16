import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import * as arrow from "apache-arrow";
import {
  RequiredTenantPolicy,
  createRagStore,
  filter,
  lanceDb,
  type CollectionDefinition,
} from "./LanceDB/index.ts";

interface Product {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  vector: number[];
}

interface Order {
  id: string;
  tenantId: string;
  productId: string;
  customer: string;
  status: string;
  amount: number;
  vector: number[];
}

const directory = join(process.cwd(), "data", "lancedb-business-demo");
await rm(directory, { recursive: true, force: true });

const vectorField = () =>
  new arrow.FixedSizeList(
    3,
    new arrow.Field("item", new arrow.Float32(), true),
  );

const productSchema = new arrow.Schema([
  new arrow.Field("id", new arrow.Utf8(), false),
  new arrow.Field("tenantId", new arrow.Utf8(), false),
  new arrow.Field("name", new arrow.Utf8(), false),
  new arrow.Field("category", new arrow.Utf8(), false),
  new arrow.Field("price", new arrow.Float64(), false),
  new arrow.Field("stock", new arrow.Int32(), false),
  new arrow.Field("vector", vectorField(), false),
]);

const orderSchema = new arrow.Schema([
  new arrow.Field("id", new arrow.Utf8(), false),
  new arrow.Field("tenantId", new arrow.Utf8(), false),
  new arrow.Field("productId", new arrow.Utf8(), false),
  new arrow.Field("customer", new arrow.Utf8(), false),
  new arrow.Field("status", new arrow.Utf8(), false),
  new arrow.Field("amount", new arrow.Float64(), false),
  new arrow.Field("vector", vectorField(), false),
]);

const productDefinition: CollectionDefinition<Product> = {
  name: "products",
  schema: productSchema,
  initialization: "create-if-missing",
  vector: { column: "vector", dimensions: 3, metric: "cosine" },
  text: { columns: ["name"], sourceColumn: "name" },
  primaryKey: "id",
  tenantKey: "tenantId",
};

const orderDefinition: CollectionDefinition<Order> = {
  name: "orders",
  schema: orderSchema,
  initialization: "create-if-missing",
  vector: { column: "vector", dimensions: 3, metric: "cosine" },
  text: { columns: ["customer", "status"], sourceColumn: "customer" },
  primaryKey: "id",
  tenantKey: "tenantId",
};

const rag = createRagStore({
  driver: lanceDb({ uri: directory }),
  tenantPolicy: new RequiredTenantPolicy(),
});

try {
  const context = { tenantId: "shop-a" };
  const products = rag.collection(productDefinition, context);
  const orders = rag.collection(orderDefinition, context);

  console.log("\n1. 创建并新增商品表、订单表数据");
  await products.append([
    {
      id: "product-001",
      tenantId: "shop-a",
      name: "RAG Engineering Handbook",
      category: "book",
      price: 89,
      stock: 20,
      vector: [1, 0, 0],
    },
    {
      id: "product-002",
      tenantId: "shop-a",
      name: "Vector Database Course",
      category: "course",
      price: 299,
      stock: 50,
      vector: [0.8, 0.2, 0],
    },
  ]);

  await orders.append([
    {
      id: "order-001",
      tenantId: "shop-a",
      productId: "product-001",
      customer: "Alice",
      status: "pending",
      amount: 89,
      vector: [1, 0, 0],
    },
    {
      id: "order-002",
      tenantId: "shop-a",
      productId: "product-002",
      customer: "Bob",
      status: "paid",
      amount: 299,
      vector: [0.8, 0.2, 0],
    },
  ]);

  assert.equal(await products.exists(), true);
  assert.equal(await orders.exists(), true);
  assert.equal(await products.count(), 2);
  assert.equal(await orders.count(), 2);
  console.log(
    "商品数:",
    await products.count(),
    "订单数:",
    await orders.count(),
  );

  console.log("\n2. 查询商品表和订单表");
  const productHits = await products.retrieve({
    vector: [0.95, 0.05, 0],
    topK: 2,
    select: ["id", "name", "price", "stock"],
    filter: filter.eq<Product>("category", "book"),
  });
  const paidOrders = await orders.retrieve({
    vector: [0.8, 0.2, 0],
    topK: 5,
    select: ["id", "customer", "status", "amount"],
    filter: filter.eq<Order>("status", "paid"),
  });

  assert.equal(productHits[0]?.document.id, "product-001");
  assert.equal(paidOrders[0]?.document.id, "order-002");
  console.log("图书商品查询结果:", productHits);
  console.log("已支付订单查询结果:", paidOrders);

  console.log("\n3. 使用 upsert 修改商品库存和订单状态");
  const productUpdate = await products.upsert([
    {
      id: "product-001",
      tenantId: "shop-a",
      name: "RAG Engineering Handbook",
      category: "book",
      price: 79,
      stock: 18,
      vector: [1, 0, 0],
    },
  ]);
  const orderUpdate = await orders.upsert([
    {
      id: "order-001",
      tenantId: "shop-a",
      productId: "product-001",
      customer: "Alice",
      status: "paid",
      amount: 79,
      vector: [1, 0, 0],
    },
  ]);

  const updatedProducts = await products.retrieve({
    vector: [1, 0, 0],
    topK: 1,
    select: ["id", "price", "stock"],
    filter: filter.eq<Product>("id", "product-001"),
  });
  const updatedOrders = await orders.retrieve({
    vector: [1, 0, 0],
    topK: 1,
    select: ["id", "status", "amount"],
    filter: filter.eq<Order>("id", "order-001"),
  });

  assert.equal(productUpdate.updatedRows, 1);
  assert.equal(orderUpdate.updatedRows, 1);
  assert.equal(updatedProducts[0]?.document.price, 79);
  assert.equal(updatedProducts[0]?.document.stock, 18);
  assert.equal(updatedOrders[0]?.document.status, "paid");
  console.log("更新后的商品:", updatedProducts[0]);
  console.log("更新后的订单:", updatedOrders[0]);

  console.log("\n4. 删除指定订单和商品");
  await orders.delete(filter.eq<Order>("id", "order-002"));
  await products.delete(filter.eq<Product>("id", "product-002"));

  assert.equal(await orders.count(), 1);
  assert.equal(await products.count(), 1);
  assert.equal(await orders.count(filter.eq<Order>("id", "order-002")), 0);
  assert.equal(
    await products.count(filter.eq<Product>("id", "product-002")),
    0,
  );

  console.log("删除后商品数:", await products.count());
  console.log("删除后订单数:", await orders.count());
  console.log(`\n多表 CRUD 业务测试通过，数据库目录: ${directory}`);
} finally {
  await rag.dispose();
}
