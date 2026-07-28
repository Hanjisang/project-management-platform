import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

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
};

const specs = [
  {
    slug: "software-hardware-interface-list",
    title: "软硬件接口清单",
    stage: "事前准备",
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
    fill: colors.navy,
    font: { name: "Microsoft YaHei", size: 20, bold: true, color: colors.white },
    horizontalAlignment: "left",
    verticalAlignment: "center",
  };
  sheet.getRange("A1:H1").format.rowHeight = 42;

  sheet.getRange("A2:H2").merge();
  sheet.getRange("A2").values = [[`SOP · ${spec.stage}  |  V2.0  |  蓝白医疗信息化模板`]];
  sheet.getRange("A2:H2").format = {
    fill: colors.paleBlue,
    font: { name: "Microsoft YaHei", size: 10, bold: true, color: colors.primary },
    verticalAlignment: "center",
  };
  sheet.getRange("A2:H2").format.rowHeight = 24;

  sheet.getRange("A4:B9").values = [
    ["模板用途", spec.description],
    ["推荐用法", "先在“明细表”填写项目基本信息，再逐行维护业务明细；交付前导出或打印后按项目要求签字归档。"],
    ["输入区域", "浅黄色单元格为人工填写区；蓝色区域为标题或提示；绿色、橙色、红色用于状态提示。"],
    ["日期格式", "统一使用 YYYY-MM-DD；如需精确到时间，可使用 YYYY-MM-DD HH:MM。"],
    ["数据安全", "不要填写明文口令、密钥或患者身份信息；敏感数据仅填写脱敏标识、引用编号或安全保管位置。"],
    ["版本管理", "正式交付前填写版本号和确认日期；变更后另存新版本，不覆盖已签署的历史文件。"],
  ];
  sheet.getRange("A4:A9").format = {
    fill: colors.paleBlue,
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
    fill: colors.primary,
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
    fill: colors.paleYellow,
    font: { name: "Microsoft YaHei", size: 10, color: colors.body },
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: colors.line },
  };
  sheet.getRange("A12:A15").format.horizontalAlignment = "center";
  sheet.getRange("H12:H15").format.horizontalAlignment = "center";
  sheet.getRange("A12:H15").format.rowHeight = 26;

  sheet.getRange("A17:H17").merge();
  sheet.getRange("A17").values = [["说明：本 Excel 版本适合批量维护明细；如需正式签字确认，可同时使用系统提供的同名 Word 版本。"]];
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

function addMainSheet(workbook, spec) {
  const sheet = workbook.worksheets.add("明细表");
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
    fill: colors.navy,
    font: { name: "Microsoft YaHei", size: 20, bold: true, color: colors.white },
    verticalAlignment: "center",
  };
  sheet.getRange(`A1:${lastLetter}1`).format.rowHeight = 42;

  sheet.getRange(`A2:${lastLetter}2`).merge();
  sheet.getRange("A2").values = [[`${spec.description}  |  浅黄色为填写区`]];
  sheet.getRange(`A2:${lastLetter}2`).format = {
    fill: colors.paleBlue,
    font: { name: "Microsoft YaHei", size: 10, color: colors.primary, bold: true },
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
      fill: colors.paleBlue,
      font: { name: "Microsoft YaHei", size: 9, bold: true, color: colors.navy },
      horizontalAlignment: "center",
      verticalAlignment: "center",
      borders: { preset: "all", style: "thin", color: colors.line },
    };
    const valueRange = sheet.getRange(metadataValues[index]);
    valueRange.merge();
    valueRange.format = {
      fill: colors.paleYellow,
      font: { name: "Microsoft YaHei", size: 9, color: colors.body },
      verticalAlignment: "center",
      borders: { preset: "all", style: "thin", color: colors.line },
    };
  });
  sheet.getRange("E4:F4").values = [["V2.0"]];
  sheet.getRange(`A3:${lastLetter}4`).format.rowHeight = 24;
  sheet.getRange(`H4:${lastLetter}4`).format.numberFormat = "yyyy-mm-dd";

  const totalFormula = `=COUNTA(${keyLetter}${firstDataRow}:${keyLetter}${lastDataRow})`;
  const doneFormula = `=COUNTIF(${statusLetter}${firstDataRow}:${statusLetter}${lastDataRow},"*已*")+COUNTIF(${statusLetter}${firstDataRow}:${statusLetter}${lastDataRow},"通过")`;
  const attentionFormula = `=COUNTIF(${statusLetter}${firstDataRow}:${statusLetter}${lastDataRow},"*待*")+COUNTIF(${statusLetter}${firstDataRow}:${statusLetter}${lastDataRow},"不通过")`;
  const blankFormula = `=COUNTBLANK(${statusLetter}${firstDataRow}:${statusLetter}${lastDataRow})`;
  const summary = [
    ["记录数", totalFormula],
    ["完成/通过", doneFormula],
    ["待处理", attentionFormula],
    ["状态待填", blankFormula],
  ];
  const summaryPairs = Math.min(4, Math.floor(spec.headers.length / 2));
  summary.slice(0, summaryPairs).forEach(([label, formula], index) => {
    const labelCell = sheet.getCell(5, index * 2);
    const valueCell = sheet.getCell(5, index * 2 + 1);
    labelCell.values = [[label]];
    valueCell.formulas = [[formula]];
    labelCell.format = {
      fill: colors.paleBlue,
      font: { name: "Microsoft YaHei", size: 9, bold: true, color: colors.navy },
      horizontalAlignment: "center",
      verticalAlignment: "center",
      borders: { preset: "all", style: "thin", color: colors.line },
    };
    valueCell.format = {
      fill: colors.white,
      font: { name: "Microsoft YaHei", size: 13, bold: true, color: colors.primary },
      horizontalAlignment: "center",
      verticalAlignment: "center",
      borders: { preset: "all", style: "thin", color: colors.line },
      numberFormat: "0",
    };
  });
  sheet.getRange(`A6:${lastLetter}6`).format.rowHeight = 28;

  sheet.getRange(`A8:${lastLetter}8`).values = [spec.headers];
  sheet.getRange(`A8:${lastLetter}8`).format = {
    fill: colors.navy,
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
    fill: colors.paleYellow,
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

async function buildWorkbook(spec) {
  const workbook = Workbook.create();
  addInstructionSheet(workbook, spec);
  addMainSheet(workbook, spec);

  const overview = await workbook.inspect({
    kind: "workbook,sheet,table",
    maxChars: 5000,
    tableMaxRows: 5,
    tableMaxCols: 10,
  });
  console.log(`INSPECT ${spec.slug}\n${overview.ndjson}`);

  const mainRange = `明细表!A1:${columnLetter(spec.headers.length - 1)}16`;
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

  for (const sheetName of ["填写说明", "明细表"]) {
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
