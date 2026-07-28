from __future__ import annotations

from pathlib import Path
from typing import Iterable, Sequence

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "templates"

# compact_reference_guide preset with named project overrides:
# A4 landscape, 0.60/0.65-inch margins, Microsoft YaHei, and blue-white
# healthcare implementation colors.
FONT = "Microsoft YaHei"
PRIMARY = "1769E0"
NAVY = "17365D"
BODY = "24364B"
MUTED = "667A90"
PALE_BLUE = "EDF5FF"
PALE_BLUE_2 = "F6F9FD"
PALE_YELLOW = "FFF9E8"
LINE = "C8D8EA"
WHITE = "FFFFFF"
SUCCESS = "E4F4EC"

PAGE_WIDTH_IN = 11.69
PAGE_HEIGHT_IN = 8.27
MARGIN_TOP_IN = 0.60
MARGIN_BOTTOM_IN = 0.60
MARGIN_SIDE_IN = 0.65
CONTENT_WIDTH_DXA = 14900
TABLE_INDENT_DXA = 120


SPECS = [
    {
        "slug": "software-hardware-interface-list",
        "stage": "事前准备",
        "title": "软硬件接口清单",
        "subtitle": "用于项目启动阶段识别系统接口、服务器、终端、网络与外设依赖",
        "instruction": "由项目经理牵头，实施、研发、客户信息部门共同确认。数量、版本、部署位置和责任人应可追溯。",
        "summary_labels": ["清单范围", "盘点日期", "牵头部门", "确认轮次"],
        "columns": ["序号", "接口/设备名称", "类型", "规格/版本", "数量", "部署位置", "责任人", "确认状态", "备注"],
        "weights": [0.55, 1.55, 0.90, 1.10, 0.55, 1.30, 0.85, 0.90, 1.30],
        "rows": 9,
        "checks": [
            ("网络与安全", "端口、访问策略、证书和账号已确认"),
            ("设备与资源", "型号、数量、安装位置和供货责任已确认"),
            ("接口依赖", "协议、联调前置条件和对接联系人已明确"),
        ],
    },
    {
        "slug": "report-template-list",
        "stage": "事前准备",
        "title": "报告模板清单",
        "subtitle": "用于确认项目需交付的报告、单据、标签和统计模板",
        "instruction": "逐项确认模板来源、适用业务、样例版本和业务确认人；涉及打印的模板需同步验证纸张与打印机设置。",
        "summary_labels": ["业务范围", "模板总数", "业务确认人", "确认轮次"],
        "columns": ["序号", "模板名称", "适用业务", "版本", "来源", "负责人", "确认状态", "备注"],
        "weights": [0.55, 1.55, 1.35, 0.70, 0.95, 0.90, 0.90, 1.40],
        "rows": 9,
        "checks": [
            ("内容完整性", "字段、口径、排序及页眉页脚已确认"),
            ("打印适配", "纸张、方向、边距、条码及打印机已验证"),
            ("版本管理", "正式版本、样例文件和变更记录可追溯"),
        ],
    },
    {
        "slug": "pre-go-live-task-plan",
        "stage": "事前准备",
        "title": "上线前任务计划",
        "subtitle": "用于统筹上线前的准备事项、前置依赖、完成标准与责任人",
        "instruction": "任务应拆分到可验证的完成标准。计划日期变化、阻塞原因和风险升级应在备注中留痕。",
        "summary_labels": ["计划窗口", "任务总数", "总负责人", "评审日期"],
        "columns": ["序号", "任务项", "负责人", "计划开始", "计划结束", "前置条件", "完成标准", "状态", "备注"],
        "weights": [0.50, 1.50, 0.85, 0.90, 0.90, 1.25, 1.40, 0.80, 1.30],
        "rows": 10,
        "checks": [
            ("范围冻结", "上线范围、版本、数据和接口边界已冻结"),
            ("资源到位", "人员、账号、环境、设备和应急联系方式齐备"),
            ("准入评审", "未完成项已评估，不影响上线准入结论"),
        ],
    },
    {
        "slug": "environment-deployment-record",
        "stage": "事前准备",
        "title": "环境部署记录",
        "subtitle": "用于记录各环境的部署基线、版本、执行人和验证结果",
        "instruction": "每次部署应对应明确版本或制品标识；服务器地址、口令等敏感信息请仅记录保管位置，不在本表明文填写。",
        "summary_labels": ["部署环境", "部署窗口", "实施负责人", "变更单号"],
        "columns": ["序号", "环境名称", "服务器/地址", "部署组件", "部署版本", "部署时间", "实施人", "验证结果", "备注"],
        "weights": [0.50, 0.90, 1.35, 1.20, 1.00, 1.05, 0.80, 0.90, 1.30],
        "rows": 8,
        "checks": [
            ("部署前", "备份、空间、账号权限和依赖项检查完成"),
            ("部署后", "服务、日志、访问、接口和关键业务冒烟验证完成"),
            ("可回退", "备份位置、回退步骤和执行责任人已确认"),
        ],
    },
    {
        "slug": "initial-configuration-record",
        "stage": "事前准备",
        "title": "初始化配置记录",
        "subtitle": "用于记录系统上线前的基础参数、业务规则与验证结果",
        "instruction": "配置值应与已确认需求一致；涉及账号、密钥、个人信息等敏感内容仅记录引用编号或保管位置。",
        "summary_labels": ["配置环境", "配置批次", "配置负责人", "复核日期"],
        "columns": ["序号", "配置域", "配置项", "配置内容/引用", "配置人", "配置时间", "验证方式", "验证结果", "备注"],
        "weights": [0.50, 0.95, 1.30, 1.50, 0.80, 1.00, 1.20, 0.85, 1.05],
        "rows": 8,
        "checks": [
            ("需求一致", "配置项与确认需求、数据字典和权限方案一致"),
            ("双人复核", "关键参数已由非配置人员复核并记录结论"),
            ("配置留档", "导出文件、截图或变更记录已归档"),
        ],
    },
    {
        "slug": "interface-document-confirmation",
        "stage": "接口对接",
        "title": "接口文档确认记录",
        "subtitle": "用于确认接口协议、字段、编码、异常处理和版本基线",
        "instruction": "确认结论应指向具体接口文档版本；未决字段、异常码和业务口径必须形成责任人与完成日期。",
        "summary_labels": ["接口范围", "文档版本", "提出方", "确认方"],
        "columns": ["序号", "接口名称", "确认内容", "提出方", "确认方", "确认日期", "确认结论", "备注"],
        "weights": [0.50, 1.25, 2.20, 0.85, 0.85, 0.95, 0.95, 1.25],
        "rows": 8,
        "checks": [
            ("协议与安全", "地址、协议、鉴权、加密和重试策略已确认"),
            ("数据口径", "字段、类型、长度、必填、字典和时间格式已确认"),
            ("异常处理", "错误码、超时、补偿、幂等和日志追踪已确认"),
        ],
    },
    {
        "slug": "sequence-diagram-review",
        "stage": "接口对接",
        "title": "时序图（评审确认版）",
        "subtitle": "用于沉淀跨系统业务时序、关键节点、异常分支与评审结论",
        "instruction": "请将最终时序图粘贴至图示区或作为附件引用，并在评审记录中明确版本、结论和未决事项。",
        "summary_labels": ["业务场景", "图示版本", "参与系统", "评审日期"],
        "columns": ["序号", "评审要点", "涉及系统/角色", "评审意见", "责任人", "计划完成", "状态"],
        "weights": [0.50, 1.60, 1.35, 2.20, 0.85, 0.95, 0.85],
        "rows": 6,
        "checks": [
            ("正常链路", "触发条件、调用顺序、响应和落库节点清晰"),
            ("异常分支", "超时、失败、重试、回退和人工补偿已覆盖"),
            ("一致性", "时序图与接口文档、业务流程和部署方案一致"),
        ],
        "diagram_box": True,
    },
    {
        "slug": "interface-integration-record",
        "stage": "接口对接",
        "title": "接口联调记录",
        "subtitle": "用于记录接口联调批次、测试数据、问题整改与最终确认",
        "instruction": "每条记录应能关联接口版本、测试数据和问题编号；敏感测试数据需脱敏，不在附件中保留真实身份信息。",
        "summary_labels": ["联调环境", "联调批次", "双方负责人", "执行日期"],
        "columns": ["序号", "接口名称", "用例/场景", "测试数据引用", "测试结果", "问题编号", "整改结果", "确认人", "日期"],
        "weights": [0.50, 1.15, 1.45, 1.25, 0.90, 0.90, 1.20, 0.80, 0.85],
        "rows": 9,
        "checks": [
            ("可追溯", "接口版本、请求标识、日志时间和问题编号可关联"),
            ("问题闭环", "失败场景已有根因、责任人、修复版本和复测结论"),
            ("联调完成", "双方已确认正常、异常及边界场景的联调范围"),
        ],
    },
    {
        "slug": "interface-acceptance-form",
        "stage": "接口对接",
        "title": "接口对接确认表",
        "subtitle": "用于接口阶段验收，确认范围、标准、遗留问题和责任边界",
        "instruction": "仅在关键用例通过、问题处置明确且双方认可的情况下签署；有条件通过时应列明限制条件和关闭日期。",
        "summary_labels": ["验收范围", "接口版本", "验收环境", "验收日期"],
        "columns": ["序号", "验收项目", "验收标准", "验收结果", "问题/说明", "责任人", "完成日期", "签字/确认"],
        "weights": [0.50, 1.25, 1.80, 0.85, 1.65, 0.85, 0.90, 1.10],
        "rows": 8,
        "checks": [
            ("范围完整", "验收接口、版本、环境和用例范围无遗漏"),
            ("质量达标", "关键用例通过，性能、安全和稳定性满足约定"),
            ("遗留可控", "遗留问题不阻断业务，责任与关闭计划明确"),
        ],
    },
    {
        "slug": "end-to-end-test-record",
        "stage": "上线试运行",
        "title": "全流程内测记录",
        "subtitle": "用于验证端到端业务场景、角色权限、数据流与外围系统协同",
        "instruction": "优先覆盖高频、关键和异常场景；测试数据应脱敏，失败用例需关联问题编号并完成复测。",
        "summary_labels": ["测试版本", "测试环境", "测试负责人", "测试日期"],
        "columns": ["序号", "业务场景", "前置条件/数据", "测试步骤", "预期结果", "实际结果", "结论", "问题编号", "测试人"],
        "weights": [0.45, 1.20, 1.35, 1.70, 1.25, 1.20, 0.70, 0.80, 0.75],
        "rows": 9,
        "checks": [
            ("业务覆盖", "核心、异常、权限和跨系统场景覆盖充分"),
            ("数据安全", "测试数据已脱敏，截图和日志不含敏感信息"),
            ("缺陷闭环", "阻断和严重问题已关闭，其余问题已有处置计划"),
        ],
    },
    {
        "slug": "training-record",
        "stage": "上线试运行",
        "title": "培训记录",
        "subtitle": "用于记录培训计划、内容、参训人员、效果评价与后续安排",
        "instruction": "按岗位区分培训内容；签到、课件、现场照片或线上会议记录可作为附件归档。",
        "summary_labels": ["培训主题", "培训对象", "培训方式", "培训日期"],
        "columns": ["序号", "姓名/工号", "部门/岗位", "联系方式", "签到", "考核/反馈", "需跟进事项", "确认签字"],
        "weights": [0.50, 1.10, 1.25, 1.15, 0.75, 1.25, 1.75, 1.10],
        "rows": 10,
        "checks": [
            ("内容适配", "不同岗位的操作、权限和常见问题已覆盖"),
            ("效果确认", "关键岗位已完成实操或理解度确认"),
            ("资料归档", "课件、签到、答疑和补训计划已留档"),
        ],
    },
    {
        "slug": "trial-test-record",
        "stage": "上线试运行",
        "title": "试行测试记录",
        "subtitle": "用于记录试运行期间的业务使用、问题反馈、处置与关闭情况",
        "instruction": "按科室或岗位记录真实业务试行情况；涉及患者或业务敏感信息时，仅填写脱敏标识或问题编号。",
        "summary_labels": ["试行范围", "试行版本", "试行负责人", "试行周期"],
        "columns": ["序号", "科室/岗位", "试行场景", "试行时间", "试行结果", "问题与建议", "跟进人", "关闭情况", "备注"],
        "weights": [0.45, 1.00, 1.35, 0.95, 0.90, 1.70, 0.80, 0.90, 1.10],
        "rows": 9,
        "checks": [
            ("业务可用", "关键岗位能够独立完成日常业务操作"),
            ("运行稳定", "系统、接口、设备和打印在试行期运行稳定"),
            ("问题可控", "遗留问题有分级、责任人、计划和应急方案"),
        ],
    },
    {
        "slug": "go-live-plan",
        "stage": "上线试运行",
        "title": "上线方案",
        "subtitle": "用于组织上线窗口、执行步骤、责任分工、风险应对与回退",
        "instruction": "上线步骤应按时间顺序可执行、可验证、可回退；关键联系人在上线窗口内保持可联络。",
        "summary_labels": ["上线范围", "上线版本", "上线窗口", "总指挥"],
        "columns": ["阶段", "上线事项", "执行步骤/检查点", "负责人", "计划时间", "完成标志", "回退方案", "状态"],
        "weights": [0.75, 1.25, 2.20, 0.85, 1.00, 1.25, 1.55, 0.75],
        "rows": 10,
        "checks": [
            ("上线准入", "版本、数据、环境、人员和业务确认均已完成"),
            ("应急保障", "监控、备份、回退触发条件和应急联系人明确"),
            ("上线收口", "验证、通知、值守和上线后复盘安排已明确"),
        ],
    },
    {
        "slug": "go-live-confirmation",
        "stage": "上线试运行",
        "title": "上线确认单",
        "subtitle": "用于上线准入或上线完成后的多方确认与责任留痕",
        "instruction": "确认结果分为通过、有条件通过和不通过；有条件通过时必须填写限制条件、责任人和关闭日期。",
        "summary_labels": ["上线项目", "上线版本", "确认类型", "确认日期"],
        "columns": ["序号", "确认项", "确认标准", "确认结果", "说明/证据", "责任方", "完成日期", "签字/确认"],
        "weights": [0.50, 1.25, 1.85, 0.85, 1.65, 0.85, 0.90, 1.10],
        "rows": 8,
        "checks": [
            ("技术确认", "部署、接口、数据、备份、监控和安全验证通过"),
            ("业务确认", "关键流程、权限、模板、设备和用户培训满足上线"),
            ("管理确认", "遗留事项、保障安排和责任边界已经各方确认"),
        ],
    },
]


def set_run_font(run, size: float, color: str = BODY, bold: bool = False, italic: bool = False) -> None:
    run.font.name = FONT
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), FONT)
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    run.bold = bold
    run.italic = italic


def set_cell_fill(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    old = tc_pr.find(qn("w:shd"))
    if old is not None:
        tc_pr.remove(old)
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_margins(cell, top: int = 80, start: int = 120, bottom: int = 80, end: int = 120) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for edge, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        element = tc_mar.find(qn(f"w:{edge}"))
        if element is None:
            element = OxmlElement(f"w:{edge}")
            tc_mar.append(element)
        element.set(qn("w:w"), str(value))
        element.set(qn("w:type"), "dxa")


def set_cell_text(cell, text: str, *, size: float = 9.2, color: str = BODY, bold: bool = False,
                  align=WD_ALIGN_PARAGRAPH.LEFT) -> None:
    cell.text = ""
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_cell_margins(cell)
    paragraph = cell.paragraphs[0]
    paragraph.alignment = align
    paragraph.paragraph_format.space_before = Pt(2)
    paragraph.paragraph_format.space_after = Pt(2)
    paragraph.paragraph_format.line_spacing = 1.15
    run = paragraph.add_run(text)
    set_run_font(run, size=size, color=color, bold=bold)


def normalize_widths(weights: Sequence[float], total: int = CONTENT_WIDTH_DXA) -> list[int]:
    denominator = sum(weights)
    widths = [round(total * weight / denominator) for weight in weights]
    widths[-1] += total - sum(widths)
    return widths


def set_repeat_table_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def prevent_row_split(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    cant_split = OxmlElement("w:cantSplit")
    tr_pr.append(cant_split)


def set_table_geometry(table, widths: Sequence[int], total: int = CONTENT_WIDTH_DXA) -> None:
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(total))
    tbl_w.set(qn("w:type"), "dxa")
    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), str(TABLE_INDENT_DXA))
    tbl_ind.set(qn("w:type"), "dxa")
    tbl_layout = tbl_pr.find(qn("w:tblLayout"))
    if tbl_layout is None:
        tbl_layout = OxmlElement("w:tblLayout")
        tbl_pr.append(tbl_layout)
    tbl_layout.set(qn("w:type"), "fixed")

    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths:
        grid_col = OxmlElement("w:gridCol")
        grid_col.set(qn("w:w"), str(width))
        grid.append(grid_col)
    for row in table.rows:
        prevent_row_split(row)
        for index, cell in enumerate(row.cells):
            width = widths[min(index, len(widths) - 1)]
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(width))
            tc_w.set(qn("w:type"), "dxa")


def set_table_borders(table, color: str = LINE, size: str = "5") -> None:
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        node = borders.find(qn(f"w:{edge}"))
        if node is None:
            node = OxmlElement(f"w:{edge}")
            borders.append(node)
        node.set(qn("w:val"), "single")
        node.set(qn("w:sz"), size)
        node.set(qn("w:color"), color)


def add_page_number(paragraph) -> None:
    run = paragraph.add_run("第 ")
    set_run_font(run, size=8.5, color=MUTED)
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(end)
    tail = paragraph.add_run(" 页")
    set_run_font(tail, size=8.5, color=MUTED)


def configure_document(doc: Document, title: str) -> None:
    section = doc.sections[0]
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width = Inches(PAGE_WIDTH_IN)
    section.page_height = Inches(PAGE_HEIGHT_IN)
    section.top_margin = Inches(MARGIN_TOP_IN)
    section.bottom_margin = Inches(MARGIN_BOTTOM_IN)
    section.left_margin = Inches(MARGIN_SIDE_IN)
    section.right_margin = Inches(MARGIN_SIDE_IN)
    section.header_distance = Inches(0.30)
    section.footer_distance = Inches(0.30)

    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), FONT)
    normal._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), FONT)
    normal._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), FONT)
    normal.font.size = Pt(11)
    normal.font.color.rgb = RGBColor.from_string(BODY)
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25

    for style_name, size, color, before, after in (
        ("Heading 1", 16, NAVY, 18, 10),
        ("Heading 2", 13, PRIMARY, 14, 7),
        ("Heading 3", 12, NAVY, 10, 5),
    ):
        style = doc.styles[style_name]
        style.font.name = FONT
        style._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), FONT)
        style._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), FONT)
        style._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), FONT)
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor.from_string(color)
        style.font.bold = True
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True

    header = section.header
    header.is_linked_to_previous = False
    table = header.add_table(rows=1, cols=2, width=Inches(10.2))
    set_table_geometry(table, normalize_widths([1.0, 1.0]))
    set_table_borders(table, color=WHITE, size="0")
    set_cell_text(table.cell(0, 0), "实施项目管理平台 · SOP 交付物", size=8.5, color=MUTED, bold=True)
    set_cell_text(table.cell(0, 1), f"{title}  |  V2.0", size=8.5, color=MUTED, align=WD_ALIGN_PARAGRAPH.RIGHT)

    footer = section.footer
    footer.is_linked_to_previous = False
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    add_page_number(p)

    doc.core_properties.title = title
    doc.core_properties.subject = "项目实施 SOP 交付物模板"
    doc.core_properties.author = "实施项目管理平台"
    doc.core_properties.comments = "V2.0 蓝白医疗信息化风格模板"


def add_title_block(doc: Document, spec: dict) -> None:
    kicker = doc.add_paragraph()
    kicker.paragraph_format.space_before = Pt(3)
    kicker.paragraph_format.space_after = Pt(0)
    run = kicker.add_run(f"SOP · {spec['stage']}")
    set_run_font(run, size=9.5, color=PRIMARY, bold=True)

    title = doc.add_paragraph()
    title.paragraph_format.space_before = Pt(0)
    title.paragraph_format.space_after = Pt(3)
    title.paragraph_format.keep_with_next = True
    run = title.add_run(spec["title"])
    set_run_font(run, size=23, color=NAVY, bold=True)

    subtitle = doc.add_paragraph()
    subtitle.paragraph_format.space_before = Pt(0)
    subtitle.paragraph_format.space_after = Pt(9)
    subtitle.paragraph_format.keep_with_next = True
    run = subtitle.add_run(spec["subtitle"])
    set_run_font(run, size=10.5, color=MUTED)

    meta = doc.add_table(rows=2, cols=8)
    meta.style = "Table Grid"
    widths = normalize_widths([0.72, 1.55, 0.72, 1.55, 0.72, 1.35, 0.72, 1.67])
    set_table_geometry(meta, widths)
    set_table_borders(meta)
    labels = ["项目名称", "客户单位", "项目经理", "文档编号", "实施负责人", "编制日期", "模板版本", "文档状态"]
    values = ["", "", "", "", "", "", "V2.0", "☐ 草稿  ☐ 已确认"]
    for row_index in range(2):
        for pair_index in range(4):
            logical_index = row_index * 4 + pair_index
            label_cell = meta.cell(row_index, pair_index * 2)
            value_cell = meta.cell(row_index, pair_index * 2 + 1)
            set_cell_fill(label_cell, PALE_BLUE)
            set_cell_fill(value_cell, WHITE if values[logical_index] else PALE_YELLOW)
            set_cell_text(label_cell, labels[logical_index], size=9, color=NAVY, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
            set_cell_text(value_cell, values[logical_index], size=9, color=BODY)


def add_callout(doc: Document, text: str) -> None:
    table = doc.add_table(rows=1, cols=1)
    table.style = "Table Grid"
    set_table_geometry(table, [CONTENT_WIDTH_DXA])
    set_table_borders(table, color="B7D2F1")
    cell = table.cell(0, 0)
    set_cell_fill(cell, PALE_BLUE_2)
    set_cell_text(cell, f"填写提示  |  {text}", size=9.1, color=BODY)
    cell.paragraphs[0].runs[0].bold = False


def add_section_title(doc: Document, title: str) -> None:
    p = doc.add_paragraph(style="Heading 2")
    p.paragraph_format.keep_with_next = True
    run = p.add_run(title)
    set_run_font(run, size=13, color=PRIMARY, bold=True)


def add_summary_table(doc: Document, labels: Sequence[str]) -> None:
    table = doc.add_table(rows=2, cols=8)
    table.style = "Table Grid"
    set_table_geometry(table, normalize_widths([0.75, 1.55] * 4))
    set_table_borders(table)
    for row_index in range(2):
        for pair_index in range(4):
            logical_index = row_index * 4 + pair_index
            label = labels[logical_index] if logical_index < len(labels) else ["归档位置", "附件数量", "复核人", "复核日期"][logical_index - len(labels)]
            set_cell_fill(table.cell(row_index, pair_index * 2), PALE_BLUE)
            set_cell_fill(table.cell(row_index, pair_index * 2 + 1), PALE_YELLOW)
            set_cell_text(table.cell(row_index, pair_index * 2), label, size=8.9, color=NAVY, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
            set_cell_text(table.cell(row_index, pair_index * 2 + 1), "", size=8.9)


def add_main_table(doc: Document, headers: Sequence[str], weights: Sequence[float], row_count: int) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    widths = normalize_widths(weights)
    set_table_geometry(table, widths)
    set_table_borders(table)
    set_repeat_table_header(table.rows[0])
    for index, header in enumerate(headers):
        set_cell_fill(table.cell(0, index), PRIMARY if index == 0 else NAVY)
        set_cell_text(table.cell(0, index), header, size=8.5, color=WHITE, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    for row_number in range(1, row_count + 1):
        row = table.add_row()
        prevent_row_split(row)
        for index, cell in enumerate(row.cells):
            set_cell_fill(cell, WHITE if index == 0 else PALE_YELLOW)
            set_cell_text(cell, str(row_number) if index == 0 else "", size=8.5,
                          color=MUTED if index == 0 else BODY,
                          align=WD_ALIGN_PARAGRAPH.CENTER if index == 0 else WD_ALIGN_PARAGRAPH.LEFT)
        set_table_geometry(table, widths)


def add_diagram_box(doc: Document) -> None:
    add_section_title(doc, "二、评审时序图")
    table = doc.add_table(rows=1, cols=1)
    table.style = "Table Grid"
    set_table_geometry(table, [CONTENT_WIDTH_DXA])
    set_table_borders(table, color="A8C3DF")
    cell = table.cell(0, 0)
    set_cell_fill(cell, PALE_BLUE_2)
    cell.text = ""
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(22)
    p.paragraph_format.space_after = Pt(22)
    run = p.add_run("在此粘贴已编号的时序图，或填写附件名称与归档链接")
    set_run_font(run, size=10, color=MUTED, italic=True)


def add_checklist(doc: Document, checks: Iterable[tuple[str, str]], heading_number: str) -> None:
    add_section_title(doc, f"{heading_number}、质量核对")
    table = doc.add_table(rows=1, cols=4)
    table.style = "Table Grid"
    widths = normalize_widths([0.6, 1.25, 4.90, 1.35])
    set_table_geometry(table, widths)
    set_table_borders(table)
    for index, header in enumerate(["序号", "检查维度", "核对要求", "结论"]):
        set_cell_fill(table.cell(0, index), NAVY)
        set_cell_text(table.cell(0, index), header, size=8.8, color=WHITE, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    for row_number, (label, detail) in enumerate(checks, start=1):
        row = table.add_row()
        prevent_row_split(row)
        values = [str(row_number), label, detail, "☐ 通过  ☐ 不通过  ☐ 不适用"]
        for index, value in enumerate(values):
            set_cell_fill(row.cells[index], WHITE if index < 3 else PALE_YELLOW)
            set_cell_text(row.cells[index], value, size=8.8, color=BODY,
                          align=WD_ALIGN_PARAGRAPH.CENTER if index in (0, 1, 3) else WD_ALIGN_PARAGRAPH.LEFT)
    set_table_geometry(table, widths)


def add_conclusion(doc: Document, heading_number: str) -> None:
    add_section_title(doc, f"{heading_number}、结论与遗留事项")
    table = doc.add_table(rows=3, cols=2)
    table.style = "Table Grid"
    widths = normalize_widths([1.10, 8.90])
    set_table_geometry(table, widths)
    set_table_borders(table)
    labels = ["总体结论", "遗留事项/风险", "附件与证据"]
    placeholders = ["☐ 通过  ☐ 有条件通过  ☐ 不通过", "", ""]
    for index, label in enumerate(labels):
        set_cell_fill(table.cell(index, 0), PALE_BLUE)
        set_cell_fill(table.cell(index, 1), PALE_YELLOW)
        set_cell_text(table.cell(index, 0), label, size=9, color=NAVY, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_text(table.cell(index, 1), placeholders[index], size=9, color=BODY)


def add_signoff(doc: Document, heading_number: str) -> None:
    add_section_title(doc, f"{heading_number}、审核确认")
    table = doc.add_table(rows=4, cols=4)
    table.style = "Table Grid"
    widths = normalize_widths([1.25, 1.80, 5.45, 1.50])
    set_table_geometry(table, widths)
    set_table_borders(table)
    headers = ["确认角色", "姓名/签字", "确认意见", "日期"]
    for index, header in enumerate(headers):
        set_cell_fill(table.cell(0, index), NAVY)
        set_cell_text(table.cell(0, index), header, size=8.8, color=WHITE, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    roles = ["实施方负责人", "客户项目负责人", "业务/信息部门"]
    for row_index, role in enumerate(roles, start=1):
        for col_index in range(4):
            set_cell_fill(table.cell(row_index, col_index), PALE_YELLOW if col_index else PALE_BLUE)
            set_cell_text(table.cell(row_index, col_index), role if col_index == 0 else "", size=8.8,
                          color=NAVY if col_index == 0 else BODY,
                          bold=col_index == 0,
                          align=WD_ALIGN_PARAGRAPH.CENTER if col_index != 2 else WD_ALIGN_PARAGRAPH.LEFT)


def add_revision_log(doc: Document) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(0)
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = p.add_run("版本记录：V2.0 · 蓝白医疗信息化模板首版 · 2026-07-28")
    set_run_font(run, size=8, color=MUTED)


def build_document(spec: dict) -> Path:
    doc = Document()
    configure_document(doc, spec["title"])
    add_title_block(doc, spec)
    add_callout(doc, spec["instruction"])

    add_section_title(doc, "一、范围与基本信息")
    add_summary_table(doc, spec["summary_labels"])

    if spec.get("diagram_box"):
        add_diagram_box(doc)
        main_number = "三"
        check_number = "四"
        conclusion_number = "五"
        signoff_number = "六"
    else:
        main_number = "二"
        check_number = "三"
        conclusion_number = "四"
        signoff_number = "五"

    add_section_title(doc, f"{main_number}、明细记录")
    add_main_table(doc, spec["columns"], spec["weights"], spec["rows"])
    add_checklist(doc, spec["checks"], check_number)
    add_conclusion(doc, conclusion_number)
    add_signoff(doc, signoff_number)
    add_revision_log(doc)

    output = OUTPUT_DIR / f"{spec['slug']}.docx"
    doc.save(output)
    return output


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs = [build_document(spec) for spec in SPECS]
    print(f"generated {len(outputs)} Word templates")
    for output in outputs:
        print(output)


if __name__ == "__main__":
    main()
