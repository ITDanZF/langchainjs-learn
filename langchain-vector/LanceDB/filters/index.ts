import { invalidArgument } from "../core/errors.ts";

type Field<T extends object> = Extract<keyof T, string> | string;
type Scalar = string | number | boolean | Date | null;

export type FilterExpression<T extends object> =
  | {
      kind: "comparison";
      field: Field<T>;
      operator: "=" | "!=" | ">" | ">=" | "<" | "<=";
      value: Scalar;
    }
  | { kind: "in"; field: Field<T>; values: readonly Scalar[] }
  | { kind: "null"; field: Field<T>; isNull: boolean }
  | { kind: "and" | "or"; expressions: readonly FilterExpression<T>[] }
  | { kind: "not"; expression: FilterExpression<T> };

function comparison<T extends object>(
  field: Field<T>,
  operator: "=" | "!=" | ">" | ">=" | "<" | "<=",
  value: Scalar,
): FilterExpression<T> {
  return { kind: "comparison", field, operator, value };
}

export const filter = {
  eq: <T extends object>(field: Field<T>, value: Scalar) =>
    comparison<T>(field, "=", value),
  ne: <T extends object>(field: Field<T>, value: Scalar) =>
    comparison<T>(field, "!=", value),
  gt: <T extends object>(field: Field<T>, value: Scalar) =>
    comparison<T>(field, ">", value),
  gte: <T extends object>(field: Field<T>, value: Scalar) =>
    comparison<T>(field, ">=", value),
  lt: <T extends object>(field: Field<T>, value: Scalar) =>
    comparison<T>(field, "<", value),
  lte: <T extends object>(field: Field<T>, value: Scalar) =>
    comparison<T>(field, "<=", value),
  in: <T extends object>(field: Field<T>, values: readonly Scalar[]) =>
    ({ kind: "in", field, values }) as FilterExpression<T>,
  isNull: <T extends object>(field: Field<T>) =>
    ({ kind: "null", field, isNull: true }) as FilterExpression<T>,
  isNotNull: <T extends object>(field: Field<T>) =>
    ({ kind: "null", field, isNull: false }) as FilterExpression<T>,
  and: <T extends object>(...expressions: readonly FilterExpression<T>[]) =>
    ({ kind: "and", expressions }) as FilterExpression<T>,
  or: <T extends object>(...expressions: readonly FilterExpression<T>[]) =>
    ({ kind: "or", expressions }) as FilterExpression<T>,
  not: <T extends object>(expression: FilterExpression<T>) =>
    ({ kind: "not", expression }) as FilterExpression<T>,
};

function quoteIdentifier(identifier: string): string {
  if (!identifier.trim()) invalidArgument("Filter field must not be empty");
  return identifier
    .split(".")
    .map((segment) =>
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)
        ? segment
        : `\`${segment.replaceAll("`", "``")}\``,
    )
    .join(".");
}

function quoteValue(value: Scalar): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      invalidArgument("Filter numbers must be finite");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime()))
      invalidArgument("Filter date is invalid");
    return `timestamp '${value.toISOString().replace("T", " ").replace("Z", "")}'`;
  }
  return `'${value.replaceAll("'", "''")}'`;
}

export function compileFilter<T extends object>(
  expression: FilterExpression<T>,
  depth = 0,
): string {
  if (depth > 20) invalidArgument("Filter expression is too deeply nested");
  switch (expression.kind) {
    case "comparison": {
      if (expression.value === null) {
        if (expression.operator === "=")
          return `${quoteIdentifier(String(expression.field))} IS NULL`;
        if (expression.operator === "!=")
          return `${quoteIdentifier(String(expression.field))} IS NOT NULL`;
        invalidArgument("NULL only supports equality comparisons");
      }
      return `${quoteIdentifier(String(expression.field))} ${expression.operator} ${quoteValue(expression.value)}`;
    }
    case "in":
      if (expression.values.length === 0)
        invalidArgument("IN filter requires at least one value");
      if (expression.values.length > 1_000)
        invalidArgument("IN filter supports at most 1000 values");
      return `${quoteIdentifier(String(expression.field))} IN (${expression.values.map(quoteValue).join(", ")})`;
    case "null":
      return `${quoteIdentifier(String(expression.field))} IS ${expression.isNull ? "" : "NOT "}NULL`;
    case "and":
    case "or":
      if (expression.expressions.length === 0)
        invalidArgument(
          `${expression.kind.toUpperCase()} filter must not be empty`,
        );
      return `(${expression.expressions.map((item) => compileFilter(item, depth + 1)).join(` ${expression.kind.toUpperCase()} `)})`;
    case "not":
      return `NOT (${compileFilter(expression.expression, depth + 1)})`;
  }
}
