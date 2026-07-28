import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const threadId = "019fa645-d466-7810-88d0-e24eb398a034";
const outputDir = path.join(root, "outputs", threadId);
const qaDir = path.join(outputDir, "qa-excel");
const templateDir = path.join(root, "templates");

const colors = {
  primary: "#1769E0",
  navy: "#17365D",
  body: "#24364B",
  muted: "#667A90",
  paleBlue: "#EDF5FF",
  paleBlue2: "#F6F9FD",
  paleYellow: "#FFF9E8",
  line: "#C8D8EA",
  white: "#FFFFFF",
  green: "#E4F4EC",
  greenText: "#257A50",
  orange: "#FFF0D9",
  orangeText: "#A85B00",
  red: "#FDE5E5",
  redText: "#A93636",
  teal: "#0F766E",
  paleTeal: "#EAF6F4",
  purple: "#6D4AA2",
  palePurple: "#F3EFF9",
  orangeStrong: "#C66A16",
  paleOrange: "#FFF3E8",
  redStrong: "#B33A3A",
  paleRed: "#FCEEEE",
};

const specs = [
  {
    slug: "software-hardware-interface-list",
    title: "软硬件接口清单",
    stage: "事前准备",
    layout: "资源盘点",
    accent: colors.teal,
    accentFill: colors.paleTeal,
    sheetName: "资源清单",
    summaryLabels: ["资源项", "已确认", "存在缺口", "待确认"],
    controlTitle: "分类盘点与缺口跟踪",
    controlHeaders: ["资源类别", "盘点重点", "当前数量", "缺口数量", "责任方", "计划到位", "证据/备注"],
    controlRows: [
      ["接口", "协议、地址、鉴权、联调联系人", "", "", "", "", ""],
      ["服务器/终端", "型号、配置、数量、部署位置", "", "", "", "", ""],
      ["网络与安全", "地址、端口、策略、证书", "", "", "", "", ""],
      ["外设与打印", "驱动、纸张、条码、打印机", "", "", "", "", ""],
    ],
    description: "盘点接口、服务器、网络、终端与外设依赖，明确版本、位置和责任人。",
    headers: ["序号", "接口/设备名称", "类型", "规格/版本", "数量", "部署位置", "责任人", "确认状态", "备注"],
    widths: [7, 24, 14, 18, 9, 18, 13, 14, 24],
    keyHeader: "接口/设备名称",
    statusHeader: "确认状态",
    numericHeaders: ["数量"],
    validations: {
      类型: ["接口", "服务器", "网络", "终端", "外设", "软件", "其他"],
      确认状态: ["未确认", "确认中", "已确认", "不适用"],
    },
  },
  {
    slug: "report-template-list",
    title: "报告模板清单",
    stage: "事前准备",
    layout: "模板目录",
    accent: colors.purple,
    accentFill: colors.palePurple,
    sheetName: "模板目录",
    summaryLabels: ["模板数", "已发布", "待业务确认", "待收集"],
    controlTitle: "样例验证与发布校验",
    controlHeaders: ["模板类型", "验证重点", "样例文件", "业务确认人", "打印验证", "发布版本", "发布日期"],
    controlRows: [
      ["业务报告", "字段、口径、排序、页眉页脚", "", "", "", "", ""],
      ["单据表单", "签署区、打印方向与边距", "", "", "", "", ""],
      ["标签条码", "尺寸、条码规则、打印机适配", "", "", "", "", ""],
      ["统计模板", "周期、权限、导出与数据范围", "", "", "", "", ""],
    ],
    description: "管理项目涉及的报告、单据、标签和统计模板及其业务确认状态。",
    headers: ["序号", "模板名称", "适用业务", "版本", "来源", "负责人", "确认状态", "备注"],
    widths: [7, 25, 22, 11, 16, 14, 14, 24],
    keyHeader: "模板名称",
    statusHeader: "确认状态",
    validations: {
      来源: ["客户提供", "产品标准", "项目定制", "第三方", "其他"],
      确认状态: ["待收集", "待确认", "调整中", "已确认", "不适用"],
    },
  },
  {
    slug: "pre-go-live-task-plan",
    title: "上线前任务计划",
    stage: "事前准备",
    layout: "上线倒排",
    accent: colors.orangeStrong,
    accentFill: colors.paleOrange,
    sheetName: "倒排计划",
    summaryLabels: ["任务数", "已完成", "阻塞/待处理", "待开始"],
    controlTitle: "上线倒排里程碑",
    controlHeaders: ["时间门", "目标", "放行条件", "责任人", "计划完成", "实际完成", "结论"],
    controlRows: [
      ["D-14", "范围冻结", "版本、数据、接口和组织范围确认", "", "", "", ""],
      ["D-7", "环境就绪", "账号、服务器、网络和设备可用", "", "", "", ""],
      ["D-3", "全流程验证", "关键与异常场景通过", "", "", "", ""],
      ["D-1", "上线准入", "人员、备份、回退与通知齐备", "", "", "", ""],
    ],
    description: "统筹上线前任务、责任人、时间、前置条件和完成标准。",
    headers: ["序号", "任务项", "负责人", "计划开始", "计划结束", "前置条件", "完成标准", "状态", "备注"],
    widths: [7, 25, 14, 14, 14, 22, 24, 14, 24],
    keyHeader: "任务项",
    statusHeader: "状态",
    dateHeaders: ["计划开始", "计划结束"],
    validations: {
      状态: ["未开始", "进行中", "待确认", "已完成", "已取消"],
    },
  },
  {
    slug: "interface-integration-record",
    title: "接口联调记录",
    stage: "接口对接",
    layout: "联调执行",
    accent: colors.teal,
    accentFill: colors.paleTeal,
    sheetName: "联调记录",
    summaryLabels: ["场景数", "通过", "待整改/复测", "未执行"],
    controlTitle: "缺陷闭环与移交",
    controlHeaders: ["问题编号", "接口/场景", "根因", "修复版本", "责任人", "复测结论", "双方确认"],
    controlRows: Array.from({ length: 8 }, () => ["", "", "", "", "", "", ""]),
    description: "记录接口联调批次、场景、测试数据、问题整改与双方确认。",
    headers: ["序号", "接口名称", "用例/场景", "测试数据引用", "测试结果", "问题编号", "整改结果", "确认人", "日期"],
    widths: [7, 22, 25, 22, 14, 14, 22, 14, 14],
    keyHeader: "接口名称",
    statusHeader: "测试结果",
    dateHeaders: ["日期"],
    validations: {
      测试结果: ["未执行", "通过", "有条件通过", "不通过"],
      整改结果: ["无需整改", "待整改", "整改中", "已完成", "待复测"],
    },
  },
  {
    slug: "end-to-end-test-record",
    title: "全流程内测记录",
    stage: "上线试运行",
    layout: "场景测试",
    accent: colors.purple,
    accentFill: colors.palePurple,
    sheetName: "测试用例",
    summaryLabels: ["用例数", "通过", "失败/待处理", "未执行"],
    controlTitle: "端到端覆盖矩阵",
    controlHeaders: ["业务域/场景", "核心流程", "角色权限", "接口协同", "设备/打印", "异常恢复", "覆盖结论"],
    controlRows: [
      ["高频核心业务", "", "", "", "", "", ""],
      ["关键结果确认", "", "", "", "", "", ""],
      ["跨系统协同", "", "", "", "", "", ""],
      ["异常与补偿", "", "", "", "", "", ""],
      ["权限与审计", "", "", "", "", "", ""],
    ],
    description: "验证端到端业务、权限、数据流和外围系统协同，关联缺陷与复测结果。",
    headers: ["序号", "业务场景", "前置条件/数据", "测试步骤", "预期结果", "实际结果", "结论", "问题编号", "测试人", "测试日期"],
    widths: [7, 22, 24, 28, 22, 22, 14, 14, 13, 14],
    keyHeader: "业务场景",
    statusHeader: "结论",
    dateHeaders: ["测试日期"],
    validations: {
      结论: ["未执行", "通过", "有条件通过", "不通过"],
    },
  },
  {
    slug: "go-live-plan",
    title: "上线方案",
    stage: "上线试运行",
    layout: "上线指挥",
    accent: colors.redStrong,
    accentFill: colors.paleRed,
    sheetName: "上线执行",
    summaryLabels: ["事项数", "已完成", "风险/待处理", "待开始"],
    controlTitle: "指挥链、回退与通知",
    controlHeaders: ["控制点", "触发条件/职责", "决策人", "执行人", "通知对象", "验证方式", "结果"],
    controlRows: [
      ["上线开始", "范围、版本和窗口最终确认", "", "", "", "", ""],
      ["关键检查点", "部署、迁移或业务验证完成", "", "", "", "", ""],
      ["回退触发", "达到已约定的失败或超时阈值", "", "", "", "", ""],
      ["上线完成", "业务稳定、监控正常并完成通知", "", "", "", "", ""],
    ],
    description: "按时间顺序组织上线步骤、检查点、责任分工、完成标志和回退方案。",
    headers: ["序号", "阶段", "上线事项", "执行步骤/检查点", "负责人", "计划时间", "完成标志", "回退方案", "状态"],
    widths: [7, 14, 22, 30, 14, 18, 22, 26, 14],
    keyHeader: "上线事项",
    statusHeader: "状态",
    dateHeaders: ["计划时间"],
    validations: {
      阶段: ["上线前", "停机/切换", "部署", "数据处理", "业务验证", "上线后值守", "收尾"],
      状态: ["未开始", "进行中", "待确认", "已完成", "已回退"],
    },
  },
];

function columnLetter(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function rangeAddress(colStart, rowStart, colEnd, rowEnd) {
  return `${columnLetter(colStart)}${rowStart}:${columnLetter(colEnd)}${rowEnd}`;
}

function applyBaseFont(sheet, lastCol, lastRow) {
  sheet.getRange(rangeAddress(0, 1, lastCol, lastRow)).format.font = {
    name: "Microsoft YaHei",
    size: 10,
    color: colors.body,
  };
}

function addInstructionSheet(workbook, spec) {
  const sheet = workbook.worksheets.add("填写说明");
  sheet.showGridLines = false;
  applyBaseFont(sheet, 7, 17);
  sheet.getRange("A1:H1").merge();
  sheet.getRange("A1").values = [[`${spec.title}｜填写说明`]];
  sheet.getRange("A1:H1").format = {
    fill: spec.accent,
    font: { name: "Microsoft YaHei", size: 20, bold: true, color: colors.white },
    horizontalAlignment: "left",
    verticalAlignment: "center",
  };
  sheet.getRange("A1:H1").format.rowHeight = 42;

  sheet.getRange("A2:H2").merge();
  sheet.getRange("A2").values = [[`${spec.layout} · ${spec.stage}  |  V2.1  |  差异化交付模板`]];
  sheet.getRange("A2:H2").format = {
    fill: colors.paleBlue,
    font: { name: "Microsoft YaHei", size: 10, bold: true, color: spec.accent },
    verticalAlignment: "center",
  };
  sheet.getRange("A2:H2").format.rowHeight = 24;

  sheet.getRange("A4:B9").values = [
    ["模板用途", spec.description],
    ["推荐用法", `先查看“${spec.controlTitle}”，再在“${spec.sheetName}”逐行维护业务明细；交付前完成控制表中的确认项。`],
    ["输入区域", "浅色单元格为人工填写区；强调色区域为当前模板的控制点；绿色、橙色、红色用于状态提示。"],
    ["日期格式", "统一使用 YYYY-MM-DD；如需精确到时间，可使用 YYYY-MM-DD HH:MM。"],
    ["数据安全", "不要填写明文口令、密钥或患者身份信息；敏感数据仅填写脱敏标识、引用编号或安全保管位置。"],
    ["版本管理", "正式交付前填写版本号和确认日期；变更后另存新版本，不覆盖已签署的历史文件。"],
  ];
  sheet.getRange("A4:A9").format = {
    fill: spec.accentFill,
    font: { name: "Microsoft YaHei", size: 10, bold: true, color: colors.navy },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: colors.line },
  };
  sheet.getRange("B4:H9").merge(true);
  sheet.getRange("B4:H9").format = {
    fill: colors.white,
    font: { name: "Microsoft YaHei", size: 10, color: colors.body },
    wrapText: true,
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: colors.line },
  };
  sheet.getRange("A4:H9").format.rowHeight = 34;

  sheet.getRange("A11:H11").merge();
  sheet.getRange("A11").values = [["交付前检查"]];
  sheet.getRange("A11:H11").format = {
    fill: spec.accent,
    font: { name: "Microsoft YaHei", size: 11, bold: true, color: colors.white },
    verticalAlignment: "center",
  };
  sheet.getRange("A12:H15").values = [
    ["1", "范围、版本和责任人已确认", "", "", "", "", "", "☐"],
    ["2", "日期、状态和必填项已补齐", "", "", "", "", "", "☐"],
    ["3", "敏感信息已脱敏或改用引用编号", "", "", "", "", "", "☐"],
    ["4", "遗留问题已有责任人和计划日期", "", "", "", "", "", "☐"],
  ];
  sheet.getRange("B12:G15").merge(true);
  sheet.getRange("A12:H15").format = {
    fill: spec.accentFill,
    font: { name: "Microsoft YaHei", size: 10, color: colors.body },
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: colors.line },
  };
  sheet.getRange("A12:A15").format.horizontalAlignment = "center";
  sheet.getRange("H12:H15").format.horizontalAlignment = "center";
  sheet.getRange("A12:H15").format.rowHeight = 26;

  sheet.getRange("A17:H17").merge();
  sheet.getRange("A17").values = [[`说明：本模板采用“${spec.layout}”专用结构；完成业务明细后，请同步填写控制表并上传归档。`]];
  sheet.getRange("A17:H17").format = {
    fill: colors.paleBlue2,
    font: { name: "Microsoft YaHei", size: 9, italic: true, color: colors.muted },
    wrapText: true,
    verticalAlignment: "center",
    borders: { preset: "outside", style: "thin", color: colors.line },
  };
  sheet.getRange("A17:H17").format.rowHeight = 30;
  sheet.getRange("A1:A17").format.columnWidth = 15;
  sheet.getRange("B1:H17").format.columnWidth = 16;
  sheet.freezePanes.freezeRows(2);
  return sheet;
}

function addControlSheet(workbook, spec) {
  const sheet = workbook.worksheets.add(spec.controlTitle);
  sheet.showGridLines = false;
  const lastRow = spec.controlRows.length + 4;
  applyBaseFont(sheet, 6, Math.max(lastRow, 14));

  sheet.getRange("A1:G1").merge();
  sheet.getRange("A1").values = [[spec.controlTitle]];
  sheet.getRange("A1:G1").format = {
    fill: spec.accent,
    font: { name: "Microsoft YaHei", size: 20, bold: true, color: colors.white },
    verticalAlignment: "center",
  };
  sheet.getRange("A1:G1").format.rowHeight = 42;

  sheet.getRange("A2:G2").merge();
  sheet.getRange("A2").values = [[`${spec.title} · ${spec.layout}控制页  |  先确认本页，再完成业务明细`]];
  sheet.getRange("A2:G2").format = {
    fill: spec.accentFill,
    font: { name: "Microsoft YaHei", size: 10, bold: true, color: spec.accent },
    verticalAlignment: "center",
  };
  sheet.getRange("A2:G2").format.rowHeight = 25;

  sheet.getRange("A4:G4").values = [spec.controlHeaders];
  sheet.getRange("A4:G4").format = {
    fill: colors.navy,
    font: { name: "Microsoft YaHei", size: 9, bold: true, color: colors.white },
    wrapText: true,
    horizontalAlignment: "center",
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: colors.line },
  };
  sheet.getRange("A4:G4").format.rowHeight = 32;

  sheet.getRange(`A5:G${lastRow}`).values = spec.controlRows;
  sheet.getRange(`A5:G${lastRow}`).format = {
    fill: spec.accentFill,
    font: { name: "Microsoft YaHei", size: 9, color: colors.body },
    wrapText: true,
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: colors.line },
  };
  sheet.getRange(`A5:B${lastRow}`).format.fill = colors.white;
  sheet.getRange(`A5:G${lastRow}`).format.rowHeight = 34;

  [18, 34, 16, 16, 16, 18, 26].forEach((width, index) => {
    sheet.getRange(`${columnLetter(index)}1:${columnLetter(index)}${lastRow}`).format.columnWidth = width;
  });
  sheet.getRange(`G5:G${lastRow}`).dataValidation = {
    rule: { type: "list", values: ["未确认", "待处理", "已确认", "已完成", "不适用"] },
  };
  sheet.getRange(`G5:G${lastRow}`).conditionalFormats.add("containsText", {
    text: "已",
    format: { fill: colors.green, font: { color: colors.greenText, bold: true } },
  });
  sheet.getRange(`G5:G${lastRow}`).conditionalFormats.add("containsText", {
    text: "待",
    format: { fill: colors.orange, font: { color: colors.orangeText, bold: true } },
  });
  const table = sheet.tables.add(`A4:G${lastRow}`, true, `${spec.slug.replaceAll("-", "_")}_control`);
  table.showFilterButton = true;
  table.showBandedRows = false;
  sheet.freezePanes.freezeRows(4);
  return sheet;
}

function addMainSheet(workbook, spec) {
  const sheet = workbook.worksheets.add(spec.sheetName);
  sheet.showGridLines = false;
  const lastCol = spec.headers.length - 1;
  const lastLetter = columnLetter(lastCol);
  const keyCol = spec.headers.indexOf(spec.keyHeader);
  const statusCol = spec.headers.indexOf(spec.statusHeader);
  const keyLetter = columnLetter(keyCol);
  const statusLetter = columnLetter(statusCol);
  const firstDataRow = 9;
  const lastDataRow = 38;
  applyBaseFont(sheet, lastCol, lastDataRow);

  sheet.getRange(`A1:${lastLetter}1`).merge();
  sheet.getRange("A1").values = [[spec.title]];
  sheet.getRange(`A1:${lastLetter}1`).format = {
    fill: spec.accent,
    font: { name: "Microsoft YaHei", size: 20, bold: true, color: colors.white },
    verticalAlignment: "center",
  };
  sheet.getRange(`A1:${lastLetter}1`).format.rowHeight = 42;

  sheet.getRange(`A2:${lastLetter}2`).merge();
  sheet.getRange("A2").values = [[`${spec.description}  |  ${spec.layout}专用明细`]];
  sheet.getRange(`A2:${lastLetter}2`).format = {
    fill: spec.accentFill,
    font: { name: "Microsoft YaHei", size: 10, color: spec.accent, bold: true },
    wrapText: true,
    verticalAlignment: "center",
  };
  sheet.getRange(`A2:${lastLetter}2`).format.rowHeight = 26;

  const metadataLabels = ["项目名称", "客户单位", "项目经理", "文档编号", "版本", "更新日期"];
  const metadataCells = ["A3", "D3", "G3", "A4", "D4", "G4"];
  const metadataValues = ["B3:C3", "E3:F3", `H3:${lastLetter}3`, "B4:C4", "E4:F4", `H4:${lastLetter}4`];
  metadataLabels.forEach((label, index) => {
    const labelCell = sheet.getRange(metadataCells[index]);
    labelCell.values = [[label]];
    labelCell.format = {
      fill: spec.accentFill,
      font: { name: "Microsoft YaHei", size: 9, bold: true, color: colors.navy },
      horizontalAlignment: "center",
      verticalAlignment: "center",
      borders: { preset: "all", style: "thin", color: colors.line },
    };
    const valueRange = sheet.getRange(metadataValues[index]);
    valueRange.merge();
    valueRange.format = {
      fill: spec.accentFill,
      font: { name: "Microsoft YaHei", size: 9, color: colors.body },
      verticalAlignment: "center",
      borders: { preset: "all", style: "thin", color: colors.line },
    };
  });
  sheet.getRange("E4:F4").values = [["V2.1"]];
  sheet.getRange(`A3:${lastLetter}4`).format.rowHeight = 24;
  sheet.getRange(`H4:${lastLetter}4`).format.numberFormat = "yyyy-mm-dd";

  const totalFormula = `=COUNTA(${keyLetter}${firstDataRow}:${keyLetter}${lastDataRow})`;
  const doneFormula = `=COUNTIF(${statusLetter}${firstDataRow}:${statusLetter}${lastDataRow},"*已*")+COUNTIF(${statusLetter}${firstDataRow}:${statusLetter}${lastDataRow},"通过")`;
  const attentionFormula = `=COUNTIF(${statusLetter}${firstDataRow}:${statusLetter}${lastDataRow},"*待*")+COUNTIF(${statusLetter}${firstDataRow}:${statusLetter}${lastDataRow},"不通过")`;
  const blankFormula = `=COUNTBLANK(${statusLetter}${firstDataRow}:${statusLetter}${lastDataRow})`;
  const summary = [
    [spec.summaryLabels[0], totalFormula],
    [spec.summaryLabels[1], doneFormula],
    [spec.summaryLabels[2], attentionFormula],
    [spec.summaryLabels[3], blankFormula],
  ];
  const summaryPairs = Math.min(4, Math.floor(spec.headers.length / 2));
  summary.slice(0, summaryPairs).forEach(([label, formula], index) => {
    const labelCell = sheet.getCell(5, index * 2);
    const valueCell = sheet.getCell(5, index * 2 + 1);
    labelCell.values = [[label]];
    valueCell.formulas = [[formula]];
    labelCell.format = {
      fill: spec.accentFill,
      font: { name: "Microsoft YaHei", size: 9, bold: true, color: colors.navy },
      horizontalAlignment: "center",
      verticalAlignment: "center",
      borders: { preset: "all", style: "thin", color: colors.line },
    };
    valueCell.format = {
      fill: colors.white,
      font: { name: "Microsoft YaHei", size: 13, bold: true, color: spec.accent },
      horizontalAlignment: "center",
      verticalAlignment: "center",
      borders: { preset: "all", style: "thin", color: colors.line },
      numberFormat: "0",
    };
  });
  sheet.getRange(`A6:${lastLetter}6`).format.rowHeight = 28;

  sheet.getRange(`A8:${lastLetter}8`).values = [spec.headers];
  sheet.getRange(`A8:${lastLetter}8`).format = {
    fill: spec.accent,
    font: { name: "Microsoft YaHei", size: 9, bold: true, color: colors.white },
    wrapText: true,
    horizontalAlignment: "center",
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: colors.line },
  };
  sheet.getRange(`A8:${lastLetter}8`).format.rowHeight = 32;

  const blankRows = Array.from({ length: lastDataRow - firstDataRow + 1 }, () => Array(spec.headers.length).fill(null));
  sheet.getRange(`A${firstDataRow}:${lastLetter}${lastDataRow}`).values = blankRows;
  sheet.getRange(`A${firstDataRow}:${lastLetter}${lastDataRow}`).format = {
    fill: spec.accentFill,
    font: { name: "Microsoft YaHei", size: 9, color: colors.body },
    wrapText: true,
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: colors.line },
  };
  sheet.getRange(`A${firstDataRow}:A${lastDataRow}`).format = {
    fill: colors.white,
    font: { name: "Microsoft YaHei", size: 9, color: colors.muted },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: colors.line },
  };
  sheet.getRange(`A${firstDataRow}`).formulas = [[`=IF(${keyLetter}${firstDataRow}="","",ROW()-8)`]];
  sheet.getRange(`A${firstDataRow}:A${lastDataRow}`).fillDown();
  sheet.getRange(`A${firstDataRow}:${lastLetter}${lastDataRow}`).format.rowHeight = 30;

  spec.headers.forEach((header, index) => {
    const letter = columnLetter(index);
    sheet.getRange(`${letter}1:${letter}${lastDataRow}`).format.columnWidth = spec.widths[index];
    if ((spec.dateHeaders || []).includes(header)) {
      sheet.getRange(`${letter}${firstDataRow}:${letter}${lastDataRow}`).format.numberFormat = "yyyy-mm-dd";
      sheet.getRange(`${letter}${firstDataRow}:${letter}${lastDataRow}`).format.horizontalAlignment = "center";
    }
    if ((spec.numericHeaders || []).includes(header)) {
      sheet.getRange(`${letter}${firstDataRow}:${letter}${lastDataRow}`).format.numberFormat = "0";
      sheet.getRange(`${letter}${firstDataRow}:${letter}${lastDataRow}`).format.horizontalAlignment = "right";
    }
    if (spec.validations?.[header]) {
      sheet.getRange(`${letter}${firstDataRow}:${letter}${lastDataRow}`).dataValidation = {
        rule: { type: "list", values: spec.validations[header] },
      };
    }
  });

  const statusRange = sheet.getRange(`${statusLetter}${firstDataRow}:${statusLetter}${lastDataRow}`);
  statusRange.conditionalFormats.add("containsText", {
    text: "通过",
    format: { fill: colors.green, font: { color: colors.greenText, bold: true } },
  });
  statusRange.conditionalFormats.add("containsText", {
    text: "已",
    format: { fill: colors.green, font: { color: colors.greenText, bold: true } },
  });
  statusRange.conditionalFormats.add("containsText", {
    text: "待",
    format: { fill: colors.orange, font: { color: colors.orangeText, bold: true } },
  });
  statusRange.conditionalFormats.add("containsText", {
    text: "不通过",
    format: { fill: colors.red, font: { color: colors.redText, bold: true } },
  });

  const table = sheet.tables.add(`A8:${lastLetter}${lastDataRow}`, true, `${spec.slug.replaceAll("-", "_")}_table`);
  table.showFilterButton = true;
  table.showBandedRows = false;
  sheet.freezePanes.freezeRows(8);
  sheet.freezePanes.freezeColumns(1);
  return sheet;
}

async function persistFreezePanes(filePath) {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const paneBySheet = [
    { file: "xl/worksheets/sheet1.xml", pane: '<pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/>' },
    { file: "xl/worksheets/sheet2.xml", pane: '<pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>' },
    { file: "xl/worksheets/sheet3.xml", pane: '<pane xSplit="1" ySplit="8" topLeftCell="B9" activePane="bottomRight" state="frozen"/>' },
  ];

  for (const { file, pane } of paneBySheet) {
    const entry = zip.file(file);
    if (!entry) throw new Error(`Missing worksheet XML: ${file}`);
    let xml = await entry.async("string");
    if (!xml.includes(":pane ") && !xml.includes("<pane ")) {
      const namespacedPane = pane.replace("<pane", "<x:pane");
      xml = xml.replace(
        /<x:sheetView\b([^>]*)\/>/,
        `<x:sheetView$1>${namespacedPane}</x:sheetView>`,
      );
      zip.file(file, xml);
    }
  }

  await fs.writeFile(
    filePath,
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    }),
  );
}

async function buildWorkbook(spec) {
  const workbook = Workbook.create();
  addInstructionSheet(workbook, spec);
  addControlSheet(workbook, spec);
  addMainSheet(workbook, spec);

  const overview = await workbook.inspect({
    kind: "workbook,sheet,table",
    maxChars: 5000,
    tableMaxRows: 5,
    tableMaxCols: 10,
  });
  console.log(`INSPECT ${spec.slug}\n${overview.ndjson}`);

  const mainRange = `'${spec.sheetName}'!A1:${columnLetter(spec.headers.length - 1)}16`;
  const check = await workbook.inspect({
    kind: "table",
    range: mainRange,
    include: "values,formulas",
    tableMaxRows: 16,
    tableMaxCols: 12,
    maxChars: 6000,
  });
  console.log(`CHECK ${spec.slug}\n${check.ndjson}`);

  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 100 },
    summary: `formula error scan ${spec.slug}`,
    maxChars: 3000,
  });
  console.log(`ERROR_SCAN ${spec.slug}\n${errors.ndjson}`);

  for (const sheetName of ["填写说明", spec.controlTitle, spec.sheetName]) {
    const preview = await workbook.render({
      sheetName,
      autoCrop: "all",
      scale: 1.2,
      format: "png",
    });
    const previewPath = path.join(qaDir, `${spec.slug}-${sheetName}.png`);
    await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
  }

  const outputPath = path.join(outputDir, `${spec.slug}.xlsx`);
  const templatePath = path.join(templateDir, `${spec.slug}.xlsx`);
  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(outputPath);
  await persistFreezePanes(outputPath);
  await fs.copyFile(outputPath, templatePath);
  console.log(`SAVED ${outputPath}`);
  return { outputPath, templatePath };
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(qaDir, { recursive: true });
await fs.mkdir(templateDir, { recursive: true });

for (const spec of specs) {
  await buildWorkbook(spec);
}

console.log(`generated ${specs.length} Excel templates`);
