from pathlib import Path
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT

ROOT=Path(r'C:\Users\Administrator\Documents\PIS系统需求\templates')
ROOT.mkdir(exist_ok=True)
items=[
('software-hardware-interface-list','软硬件接口清单',['序号','接口/设备名称','类型','规格/版本','数量','部署位置','责任人','确认状态','备注']),
('report-template-list','报告模板清单',['序号','模板名称','适用业务','版本','来源','负责人','确认状态','备注']),
('pre-go-live-task-plan','上线前任务计划',['序号','任务项','负责人','计划开始','计划结束','前置条件','完成标准','状态','备注']),
('environment-deployment-record','环境部署记录',['序号','环境名称','服务器/地址','部署组件','部署版本','部署时间','实施人','验证结果','备注']),
('initial-configuration-record','初始化配置记录',['序号','配置项','配置内容','配置人','配置时间','验证方式','验证结果','备注']),
('interface-document-confirmation','接口文档确认记录',['序号','接口名称','字段/协议确认内容','提出方','确认方','确认日期','确认结论','备注']),
('sequence-diagram-review','时序图（评审确认版）',['图名称','业务场景','参与系统','版本','评审人','评审日期','评审结论','备注']),
('interface-integration-record','接口联调记录',['序号','接口名称','联调环境','测试数据','测试结果','问题记录','整改结果','确认人','日期']),
('interface-acceptance-form','接口对接确认表',['序号','验收项目','验收标准','验收结果','问题/说明','责任人','确认日期','签字/确认']),
('end-to-end-test-record','全流程内测记录',['序号','测试场景','测试步骤/数据','预期结果','实际结果','是否通过','问题编号','测试人','日期']),
('training-record','培训记录',['序号','培训主题','培训对象','培训时间','培训地点/方式','培训内容摘要','签到情况','培训人','备注']),
('trial-test-record','试行测试记录',['序号','科室/岗位','试行场景','试行时间','试行结果','问题与建议','跟进人','关闭情况','备注']),
('go-live-plan','上线方案',['阶段','上线事项','执行步骤','负责人','计划时间','回退方案','风险与应对','确认状态']),
('go-live-confirmation','上线确认单',['确认项','确认标准','确认结果','说明','责任方','确认日期','签字']),
]

def shade(cell,fill):
    tcPr=cell._tc.get_or_add_tcPr(); from docx.oxml import OxmlElement
    shd=OxmlElement('w:shd'); shd.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill',fill); tcPr.append(shd)
for slug,title,cols in items:
    d=Document(); sec=d.sections[0]; sec.top_margin=Inches(.65); sec.bottom_margin=Inches(.65); sec.left_margin=Inches(.65); sec.right_margin=Inches(.65)
    normal=d.styles['Normal']; normal.font.name='Microsoft YaHei'; normal.font.size=Pt(9); normal._element.rPr.rFonts.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}eastAsia','Microsoft YaHei')
    p=d.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; r=p.add_run('实施项目管理平台'); r.bold=True; r.font.size=Pt(10); r.font.color.rgb=RGBColor(23,105,224)
    p=d.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; r=p.add_run(title); r.bold=True; r.font.size=Pt(18); r.font.color.rgb=RGBColor(22,54,95)
    meta=d.add_table(rows=2,cols=4); meta.alignment=WD_TABLE_ALIGNMENT.CENTER; meta.style='Table Grid'
    for row in meta.rows:
        for c in row.cells: c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
    for c,v in zip(meta.rows[0].cells,['项目名称：','客户：','负责人：','模板版本：V1.0']): c.text=v
    for c,v in zip(meta.rows[1].cells,['文档编号：','填写日期：','审核人：','状态：□草稿  □已确认']): c.text=v
    d.add_paragraph('填写说明：请依据项目实际情况填写，涉及确认的内容应由责任方签字或确认。')
    t=d.add_table(rows=1,cols=len(cols)); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.style='Table Grid'
    for i,h in enumerate(cols):
        cell=t.rows[0].cells[i]; cell.text=h; shade(cell,'DCEBFA');
        for run in cell.paragraphs[0].runs: run.bold=True
    for _ in range(8):
        cells=t.add_row().cells
        for c in cells: c.text=''
    d.add_paragraph(); p=d.add_paragraph('备注/结论：'); p.runs[0].bold=True
    d.add_paragraph('\n\n')
    p=d.add_paragraph('编制：____________    审核：____________    确认日期：____________'); p.alignment=WD_ALIGN_PARAGRAPH.RIGHT
    d.save(ROOT/f'{slug}.docx')
print(f'generated {len(items)} templates')
