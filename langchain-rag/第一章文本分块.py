from accelerate.test_utils.scripts.external_deps.test_ds_alst_ulysses_sp import model_name
from langchain_text_splitters import CharacterTextSplitter, RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
import os
from langchain_experimental.text_splitter import SemanticChunker
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.document_loaders import TextLoader
"""
文本分块：
文本分块的首要原因是在RAG系统中，嵌入模型 的输入限制 以及 大语言模型 上下文窗口的限制
"""

def main1():
    path_txt = "./data/C2/txt/蜂医.txt"
    loader = TextLoader(path_txt, encoding="utf-8")

    docs = loader.load()

    text_splitter = CharacterTextSplitter(
        chunk_size=200, # 每个块的目标大小为100个字符
        chunk_overlap=10 # 每个块之间重叠10个字符，以环节语义割裂
    )

    chunks = text_splitter.split_documents(docs)

    print(f"文本被切分为 {len(chunks)} 个块。\n")
    print("--- 前5个块内容示例 ---")

    for i, chunk in enumerate(chunks[:5]):
        print("=" * 60)
        print(f'块 {i + 1} (长度 : {len(chunk.page_content)}): "{chunk.page_content}"')



def main2():
    """
    递归字符分块
    这种分块器通过分隔符层级递归处理，相对与固定大小分块，改善了超长文本的处理效果。

    算法流程： （1）寻找有效分隔符: 从分隔符列表中从前到后遍历，找到第一个在当前文本中存在的分隔符。如果都不存在，
    使用最后一个分隔符（通常是空字符串 ""）。

    :return:
    """
    path_txt = "./data/C2/txt/蜂医.txt"
    loader = TextLoader(path_txt, encoding="utf-8")
    docs = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(
        separators=["\n\n", "\n", "。", "，", " ", ""],# 分隔符优先级
        chunk_size=200,
        chunk_overlap=10
    )


def main3():
    """
    语义分块
    在语义主题发生显著变化的地方进行切分
    （1）句子分割 (Sentence Splitting)**：首先，使用标准的句子分割规则（例如，基于句号、问号、感叹号）将输入文本拆分成一个句子列表。

    （2）上下文感知嵌入 (Context-Aware Embedding)**：这是 SemanticChunker 的一个关键设计。该分块器不是对每个句子独立进行嵌入，而是通过 buffer_size 参数（默认为1）来捕捉上下文信息。对于列表中的每一个句子，这种方法会将其与前后各 buffer_size 个句子组合起来，然后对这个临时的、更长的组合文本进行嵌入。这样，每个句子最终得到的嵌入向量就融入了其上下文的语义。

    （3）计算语义距离 (Distance Calculation)：计算每对相邻句子的嵌入向量之间的余弦距离。这个距离值量化了两个句子之间的语义差异——距离越大，表示语义关联越弱，跳跃越明显。

    （4）识别断点 (Breakpoint Identification)**：SemanticChunker 会分析所有计算出的距离值，并根据一个统计方法（默认为 percentile）来确定一个动态阈值。例如，它可能会将所有距离中第95百分位的值作为切分阈值。所有距离大于此阈值的点，都被识别为语义上的“断点”。

    （5）合并成块 (Merging into Chunks)**：最后，根据识别出的所有断点位置，将原始的句子序列进行切分，并将每个切分后的部分内的所有句子合并起来，形成一个最终的、语义连贯的文本块。
    """

    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-small-zh-v1.5",
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )

    text_splitter = SemanticChunker(
        embeddings,
        breakpoint_threshold_type="percentile",
    )
    path_txt = "./data/C2/txt/蜂医.txt"
    loader = TextLoader(path_txt, encoding="utf-8")
    documents = loader.load()
    docs = text_splitter.split_documents(documents)


if __name__ == '__main__':
    # main1()
    # main2()
    main3()
    pass