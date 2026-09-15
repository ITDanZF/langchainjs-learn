from unstructured.partition.auto import partition
from unstructured.partition.pdf import partition_pdf
from collections import Counter

# hi_res
# - 使用版面检测模型分析页面结构。
# - 更容易区分 Title、NarrativeText、ListItem、Table 等元素。
# - 对表格、多栏排版、图片混排的 PDF 更合适。
# - 速度较慢，并且需要额外的模型依赖。
#
# ocr_only
# - 把页面作为图像进行 OCR。
# - 适合扫描件、图片型 PDF。
# - 对标题、段落和表格等版面结构的判断通常不如 hi_res。
# - 可能产生错字、空格异常或段落顺序变化。

def main1():
    pdf_path = './data/C2/pdf/rag.pdf'

    elements = partition(
        filename=pdf_path,
        content_type="application/pdf",
    )

    # 打印解析结果
    print(f"解析完成: {len(elements)} 个元素, {sum(len(str(e)) for e in elements)} 字符")

    types = Counter( e.category for e in elements)
    print(f"元素类型：{dict(types)}")


    # 显示所有元素
    print("\n显示所有元素：")
    for i , element in enumerate(elements):
        print(f"{i}: {element}")
        print(element)
        print("=" * 100)

def main2_hi_res():
    pdf_path = './data/C2/pdf/rag.pdf'

    hi_res_elements = partition_pdf(
        filename=pdf_path,
        strategy="hi_res",
        languages=["chi_sim", "eng"],

        # 尝试识别表结构
        infer_table_structure=True,

        # 在结果中保留分页元素
        include_page_breaks=True,
    )

    total_characters = sum(len(str(element)) for element in hi_res_elements)
    element_types = Counter(element.type for element in hi_res_elements)
    print(f"解析完成：{len(hi_res_elements)} 个元素，{total_characters} 个字符")
    print(f"元素类型：{dict(element_types)}")

    print("\n解析结果：")
    for index, element in enumerate(hi_res_elements, start=1):
        page_number = getattr(element.metadata, "page_number", None)

        print(
            f"\nElement {index} "
            f"[类型={element.category}, 页码={page_number}]"
        )
        print(element)
        print("-" * 80)

if __name__ == "__main__":
    # main1()
    main2_hi_res()