import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';
import type { PrismaClient } from '@prisma/client';

const SOP_CODE = 'PIS-IMPLEMENTATION-LIFECYCLE';
const SOP_VERSION = 'V1.9.2';
const OBJECT_ROOT = 'system/sop/v1.9.2';
const PACK_ENTRIES: Record<string, [number, number]> = {
  '三方会议纪要_标准模板_V1.0.docx': [0, 25518],
  '软硬件及接口清单_标准模板_V1.0.xlsx': [25518, 23650],
  '进场条件核查表_标准模板_V1.0.docx': [49168, 23628],
  '项目实施方案_标准模板_V1.0.docx': [72796, 41713],
  '项目计划_标准模板_V1.0.xlsx': [114509, 29387],
  '项目调研报告_标准模板_V1.0.docx': [143896, 40080],
  '培训签到表_标准模板_V1.0.docx': [183976, 25037],
  '系统部署配置确认单_标准模板_V1.0.xlsx': [209013, 28249],
  '软硬件接口联调确认表_标准模板_V1.0.xlsx': [237262, 23589],
  '上线条件评估表_标准模板_V1.0.xlsx': [260851, 51007],
  '试运行报告_标准模板_V1.0.docx': [311858, 28437],
  '需求清单_标准模板_V1.0.xlsx': [340295, 24682],
  '上线实施方案_儿童医院.docx': [364977, 35511],
  '上线实施方案_标准模板_V1.0.docx': [400488, 42948],
  '上线报告_标准模板_V1.0.docx': [443436, 25929],
  '项目交付清单_标准模板_V1.0.xlsx': [469365, 17408],
  '项目验收报告_标准模板_V1.0.docx': [486773, 28942],
};
const MIME: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

type TaskSeed = { key: string; name: string; description: string };
type StageSeed = { key: string; name: string; description: string; tasks: TaskSeed[] };
type DeliverableSeed = {
  key: string;
  taskKey: string;
  name: string;
  description: string;
  files: Array<[string, string]>;
};

const task = (key: string, name: string, description: string): TaskSeed => ({ key, name, description });
const stages: StageSeed[] = [
  {
    key: 'pis-v192-s1',
    name: '01 事前准备',
    description: '调研、三方确认、条件准备、进场准入与项目启动。准入通过并完成启动会后进入实施执行。',
    tasks: [
      task('pis-v192-s1-t1', '项目接收与基础调研', '梳理项目类型、现状、业务范围、环境、资源、计划及验收安排。'),
      task('pis-v192-s1-t2', '范围及交付边界', '以双方确认的标准版本和接口清单为基线，非标准内容单独评估。'),
      task('pis-v192-s1-t3', '三方准备与协同确认', '确认业务流程、数据流向、接口清单、联调窗口、责任人和未决事项。'),
      task('pis-v192-s1-t4', '接口与第三方条件', '确认接口文档来源/版本，并锁定实际联调工程师及时间窗口。'),
      task('pis-v192-s1-t5', '院方环境与测试条件', '核验服务器、网络、账号权限、测试数据和真实联调条件。'),
      task('pis-v192-s1-t6', '替换项目专项核查', '替换项目核查历史数据范围、原系统信息、病理号衔接及完整备份条件。'),
      task('pis-v192-s1-t7', '内部实施准备', '完成项目计划、实施方案、风险说明和资源安排。'),
      task('pis-v192-s1-t8', '进场准入评审', '形成具备进场/有条件进场/暂不具备进场条件的明确结论。'),
      task('pis-v192-s1-t9', '项目启动会', '确认目标、范围、分工、里程碑、近期安排、沟通机制、升级路径及风险。'),
    ],
  },
  {
    key: 'pis-v192-s2',
    name: '02 实施执行',
    description: '环境、配置、接口、数据、测试与培训。完成关键实施记录并消除阻塞试行的重大问题。',
    tasks: [
      task('pis-v192-s2-t1', '系统环境搭建', '完成服务器、数据库、中间件、应用服务、备份日志及客户端/外设验证。'),
      task('pis-v192-s2-t2', '系统初始化配置', '完成组织、用户、权限、字典、规则、流程、参数、报告及打印模板初始化。'),
      task('pis-v192-s2-t3', '接口文档与时序确认', '确认接口范围、方向、字段、认证、异常补偿、日志及业务时序。'),
      task('pis-v192-s2-t4', '接口开发与联调', '完成接口开发配置、单接口测试、业务场景联调及异常回归。'),
      task('pis-v192-s2-t5', '数据准备与迁移', '完成备份、清洗、转换、映射、迁移及数量/字段/关联核对。'),
      task('pis-v192-s2-t6', '功能与集成测试', '验证核心业务、报告、接口、统计、异常业务、权限及备份恢复。'),
      task('pis-v192-s2-t7', '用户培训', '按管理员、业务操作、医技、诊断、信息科等岗位培训和演练。'),
      task('pis-v192-s2-t8', '实施问题闭环', '统一登记、分级、定责、限时、验证并关闭问题；范围变化走评审。'),
    ],
  },
  {
    key: 'pis-v192-s3',
    name: '03 试行验证',
    description: '以真实或准真实业务验证功能、接口、数据、设备和人员操作，并形成上线判断依据。',
    tasks: [
      task('pis-v192-s3-t1', '试行方案制定', '明确范围、参与人员、周期、数据口径、反馈渠道及退出/暂停条件。'),
      task('pis-v192-s3-t2', '真实业务运行', '从申请、登记、技术处理、诊断、审核到报告回传形成完整闭环。'),
      task('pis-v192-s3-t3', '流程与功能验证', '验证权限、模板、标签、外设、接口、异常业务、补退费及历史查询。'),
      task('pis-v192-s3-t4', '运行与性能观察', '关注稳定性、页面响应、接口成功率、数据准确性、报告回传及操作效率。'),
      task('pis-v192-s3-t5', '需求及问题收集与整改', '持续维护需求清单，试运行问题完成分级处理及回归验证。'),
      task('pis-v192-s3-t6', '上线条件评估（含上线前核验）', '核验生产环境、版本脚本、接口功能、测试培训、备份及应急/回退方案。'),
    ],
  },
  {
    key: 'pis-v192-s4',
    name: '04 上线切换',
    description: '依据上线条件评估结论完成生产切换、核心业务验证和现场/远程保障。',
    tasks: [
      task('pis-v192-s4-t1', '上线方案与组织', '明确时间窗口、版本、分工、数据、接口、业务暂停及保障安排。'),
      task('pis-v192-s4-t2', '生产备份与冻结', '完成程序、数据库和关键配置备份，确认版本冻结、窗口及回退基线。'),
      task('pis-v192-s4-t3', '正式部署与切换', '执行生产部署、数据库升级、数据迁移/同步、接口切换及终端设备配置。'),
      task('pis-v192-s4-t4', '上线后快速验证', '验证登录、核心业务、接口、报告打印、数据、日志及业务状态。'),
      task('pis-v192-s4-t5', '上线保障与应急', '建立支持和升级机制，优先处置 P0/P1，必要时回退或启用应急流程。'),
      task('pis-v192-s4-t6', '上线记录与结果确认', '记录切换、验证证据、异常和遗留事项，形成正式上线结论。'),
    ],
  },
  {
    key: 'pis-v192-s5',
    name: '05 验收交付',
    description: '完成合同对照、验收整改、资料移交、归档和后续服务责任交接。',
    tasks: [
      task('pis-v192-s5-t1', '验收准备', '对照合同和确认需求梳理验收范围并检查实施完成情况。'),
      task('pis-v192-s5-t2', '验收资料整理', '准备验收方案、功能对照、测试培训、试运行、完成说明及演示环境。'),
      task('pis-v192-s5-t3', '验收测试', '验证功能、流程、接口、数据、性能、权限、报表、设备和文档完整性。'),
      task('pis-v192-s5-t4', '验收评审', '汇报建设情况、演示核心流程并形成正式验收意见。'),
      task('pis-v192-s5-t5', '验收问题整改', '对验收意见定责限时，完成修复、验证、整改说明和关闭确认。'),
      task('pis-v192-s5-t6', '项目资料交付', '移交部署、脚本、配置、接口、手册、测试培训、版本及备份恢复资料。'),
      task('pis-v192-s5-t7', '交付与后续责任确认', '通过交付清单确认资料、接收状态、归档路径和遗留事项责任。'),
    ],
  },
];

const deliverables: DeliverableSeed[] = [
  { key: 'pis-v192-d01', taskKey: 'pis-v192-s1-t1', name: '项目调研报告', description: '项目现状、范围、环境、实施基础条件及调研结论。', files: [['项目调研报告_标准模板_V1.0.docx', '01-project-survey-report-v1.0.docx']] },
  { key: 'pis-v192-d02', taskKey: 'pis-v192-s1-t4', name: '软硬件及接口清单', description: '服务器、终端、软件、网络、设备及系统接口基础信息。', files: [['软硬件及接口清单_标准模板_V1.0.xlsx', '02-hardware-software-interface-list-v1.0.xlsx']] },
  { key: 'pis-v192-d03', taskKey: 'pis-v192-s1-t7', name: '项目计划', description: '任务、里程碑、责任人、计划时间及交付节点。', files: [['项目计划_标准模板_V1.0.xlsx', '03-project-plan-v1.0.xlsx']] },
  { key: 'pis-v192-d04', taskKey: 'pis-v192-s1-t7', name: '项目实施方案', description: '实施范围、方法、组织分工、进度、风险及保障措施。', files: [['项目实施方案_标准模板_V1.0.docx', '04-project-implementation-plan-v1.0.docx']] },
  { key: 'pis-v192-d05', taskKey: 'pis-v192-s1-t8', name: '进场条件核查表', description: '进场条件确认唯一正式载体，统一承载院方范围、配合事项及确认要求。', files: [['进场条件核查表_标准模板_V1.0.docx', '05-entry-condition-checklist-v1.0.docx']] },
  { key: 'pis-v192-d06', taskKey: 'pis-v192-s1-t9', name: '三方会议纪要', description: '记录范围、计划、责任和待办共识。', files: [['三方会议纪要_标准模板_V1.0.docx', '06-tripartite-meeting-minutes-v1.0.docx']] },
  { key: 'pis-v192-d07', taskKey: 'pis-v192-s2-t1', name: '系统部署配置确认单', description: '系统环境部署、基础配置及验证结果。', files: [['系统部署配置确认单_标准模板_V1.0.xlsx', '07-system-deployment-confirmation-v1.0.xlsx']] },
  { key: 'pis-v192-d08', taskKey: 'pis-v192-s2-t4', name: '软硬件接口联调确认表', description: '接口/设备联调范围、场景、结果及遗留事项。', files: [['软硬件接口联调确认表_标准模板_V1.0.xlsx', '08-interface-integration-confirmation-v1.0.xlsx']] },
  { key: 'pis-v192-d09', taskKey: 'pis-v192-s2-t7', name: '培训签到表', description: '每场培训的人员、内容、时间及签认记录。', files: [['培训签到表_标准模板_V1.0.docx', '09-training-attendance-v1.0.docx']] },
  { key: 'pis-v192-d10', taskKey: 'pis-v192-s3-t2', name: '试运行报告', description: '试运行范围、周期、运行情况、问题整改和结论。', files: [['试运行报告_标准模板_V1.0.docx', '10-trial-operation-report-v1.0.docx']] },
  { key: 'pis-v192-d11', taskKey: 'pis-v192-s3-t5', name: '需求清单', description: '持续记录需求/问题、优先级、责任人、状态及处理结论。', files: [['需求清单_标准模板_V1.0.xlsx', '11-requirement-list-v1.0.xlsx']] },
  { key: 'pis-v192-d12', taskKey: 'pis-v192-s3-t6', name: '上线条件评估表', description: '上线前核验项、结论、风险及放行意见。', files: [['上线条件评估表_标准模板_V1.0.xlsx', '12-go-live-readiness-assessment-v1.0.xlsx']] },
  { key: 'pis-v192-d13', taskKey: 'pis-v192-s4-t1', name: '上线实施方案', description: '生产切换步骤、分工、验证、保障及回退安排。', files: [['上线实施方案_标准模板_V1.0.docx', '13-go-live-implementation-plan-v1.0.docx'], ['上线实施方案_儿童医院.docx', '13-go-live-implementation-plan-childrens-hospital-reference.docx']] },
  { key: 'pis-v192-d14', taskKey: 'pis-v192-s4-t6', name: '上线报告', description: '切换过程、验证证据、异常、遗留事项及上线结论。', files: [['上线报告_标准模板_V1.0.docx', '14-go-live-report-v1.0.docx']] },
  { key: 'pis-v192-d15', taskKey: 'pis-v192-s5-t4', name: '项目验收报告', description: '验收范围、验证情况、问题整改及正式验收结论。', files: [['项目验收报告_标准模板_V1.0.docx', '15-project-acceptance-report-v1.0.docx']] },
  { key: 'pis-v192-d16', taskKey: 'pis-v192-s5-t7', name: '项目交付清单', description: '最终交付资料索引，记录版本、提交/接收、归档及签收情况。', files: [['项目交付清单_标准模板_V1.0.xlsx', '16-project-delivery-checklist-v1.0.xlsx']] },
];

const checklistByTask: Record<string, Array<[string, boolean?]>> = {
  'pis-v192-s1-t8': [
    ['项目范围已明确'], ['第三方技术人员及联调窗口已落实'], ['接口文档完整且与实际版本一致'],
    ['服务器、网络及关键账号权限已准备'], ['测试数据及 HIS/第三方实际测试条件已具备'],
    ['替换项目历史数据范围及完整备份条件已确认（非替换项目可标记不适用）', false],
  ],
  'pis-v192-s1-t9': [['项目目标与范围已确认'], ['项目责任分工已确认'], ['实施计划与关键里程碑已确认'], ['沟通机制及问题升级路径已确认']],
  'pis-v192-s2-t8': [['系统部署及基础配置完成'], ['主要接口及设备联调完成'], ['必要用户培训完成'], ['无阻塞业务试行的重大问题']],
  'pis-v192-s3-t6': [['生产环境、服务器、网络及账号权限已核验'], ['正式版本及数据库脚本已确认'], ['关键接口及核心功能验证通过'], ['测试结论及必要培训已完成'], ['备份、应急及回退方案已确认']],
  'pis-v192-s4-t6': [['上线切换已按方案执行'], ['关键业务验证通过'], ['异常及遗留事项均已明确责任人和处理计划'], ['正式上线结论已形成']],
  'pis-v192-s5-t7': [['正式验收结论已经形成'], ['项目资料已完成移交和签收'], ['项目归档路径已明确'], ['遗留事项已纳入后续跟踪']],
};

function weights(count: number): number[] {
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

let assetPack: Buffer | null = null;
async function pack(): Promise<Buffer> {
  if (assetPack) return assetPack;
  const directory = join(dirname(fileURLToPath(import.meta.url)), 'preloaded-templates', 'sop-v1.9.2', 'pack');
  const names = (await readdir(directory)).filter((name) => name.endsWith('.b64')).sort();
  if (!names.length) throw new Error('Preloaded SOP template asset pack is missing');
  const encoded = (await Promise.all(names.map((name) => readFile(join(directory, name), 'utf8')))).join('');
  assetPack = brotliDecompressSync(Buffer.from(encoded, 'base64'));
  return assetPack;
}
async function templateBuffer(fileName: string): Promise<Buffer> {
  const entry = PACK_ENTRIES[fileName];
  if (!entry) throw new Error(`Missing packed template manifest entry: ${fileName}`);
  const source = await pack();
  const result = source.subarray(entry[0], entry[0] + entry[1]);
  if (result.length !== entry[1]) throw new Error(`Packed template is truncated: ${fileName}`);
  return result;
}

async function materializeFile(prisma: PrismaClient, uploaderUserId: string, deliverableId: string, file: [string, string]) {
  const [fileName, objectName] = file;
  const content = await templateBuffer(fileName);
  const checksum = createHash('sha256').update(content).digest('hex');
  const mimeType = MIME[extname(fileName).toLowerCase()];
  if (!mimeType) throw new Error(`Unsupported preloaded template type: ${fileName}`);
  const objectKey = `${OBJECT_ROOT}/${objectName}`;
  const target = join(resolve(process.env.STORAGE_PATH ?? './storage'), objectKey);
  await mkdir(dirname(target), { recursive: true });
  let write = true;
  try { write = createHash('sha256').update(await readFile(target)).digest('hex') !== checksum; } catch { write = true; }
  if (write) await writeFile(target, content);
  await prisma.sopDeliverableTemplate.upsert({
    where: { objectKey },
    create: { deliverableId, fileName, objectKey, mimeType, size: BigInt(content.length), checksum, uploadedById: uploaderUserId },
    update: { deliverableId, fileName, mimeType, size: BigInt(content.length), checksum, uploadedById: uploaderUserId },
  });
}

async function createVersion(prisma: PrismaClient, templateId: string): Promise<string> {
  const version = await prisma.sopVersion.create({
    data: { templateId, version: SOP_VERSION, status: 'DRAFT', description: '公司标准预置版本，依据《实施全生命周期 SOP 管理规范》V1.9.2 建立。五阶段、16 个正式交付项；默认工期仅用于初始化，项目启动时按实际排期调整。' },
  });
  const stageWeights = weights(stages.length);
  for (const [stageIndex, stageSeed] of stages.entries()) {
    const stage = await prisma.sopStage.create({ data: { stableKey: stageSeed.key, sopVersionId: version.id, name: stageSeed.name, description: stageSeed.description, sortOrder: stageIndex, defaultDurationDays: stageSeed.tasks.length, weight: stageWeights[stageIndex] ?? 0 } });
    const taskWeights = weights(stageSeed.tasks.length);
    for (const [taskIndex, taskSeed] of stageSeed.tasks.entries()) {
      const sopTask = await prisma.sopTask.create({ data: { stableKey: taskSeed.key, stageId: stage.id, name: taskSeed.name, description: taskSeed.description, sortOrder: taskIndex, defaultDurationDays: 1, weight: taskWeights[taskIndex] ?? 0, required: true } });
      const checks = checklistByTask[taskSeed.key] ?? [];
      if (checks.length) await prisma.sopChecklistItem.createMany({ data: checks.map(([name, required], index) => ({ stableKey: `${taskSeed.key}-c${index + 1}`, taskId: sopTask.id, name, sortOrder: index, required: required ?? true })) });
      const taskDeliverables = deliverables.filter((item) => item.taskKey === taskSeed.key);
      for (const [index, item] of taskDeliverables.entries()) await prisma.sopDeliverable.create({ data: { stableKey: item.key, sopTaskId: sopTask.id, name: item.name, description: item.description, required: true, sortOrder: index, reviewMode: 'HUMAN_ONLY', aiReviewEnabled: false } });
    }
  }
  await prisma.sopVersion.update({ where: { id: version.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
  return version.id;
}

async function validateVersion(prisma: PrismaClient, versionId: string) {
  const found = await prisma.sopStage.findMany({ where: { sopVersionId: versionId }, include: { tasks: { include: { deliverables: true } } } });
  const taskCount = found.reduce((sum, stage) => sum + stage.tasks.length, 0);
  const deliverableCount = found.reduce((sum, stage) => sum + stage.tasks.reduce((inner, item) => inner + item.deliverables.length, 0), 0);
  if (found.length !== 5 || taskCount !== 36 || deliverableCount !== 16) throw new Error(`Preloaded SOP ${SOP_VERSION} does not match baseline (stages=${found.length}, tasks=${taskCount}, deliverables=${deliverableCount})`);
}

export async function seedPisImplementationSop(prisma: PrismaClient, uploaderUserId: string | null): Promise<void> {
  const template = await prisma.sopTemplate.upsert({
    where: { code: SOP_CODE },
    create: { code: SOP_CODE, name: 'PIS 实施全生命周期 SOP', description: '公司标准实施交付 SOP：事前准备 → 实施执行 → 试行验证 → 上线切换 → 验收交付。' },
    update: { name: 'PIS 实施全生命周期 SOP', description: '公司标准实施交付 SOP：事前准备 → 实施执行 → 试行验证 → 上线切换 → 验收交付。', deletedAt: null },
  });
  let version = await prisma.sopVersion.findUnique({ where: { templateId_version: { templateId: template.id, version: SOP_VERSION } }, select: { id: true, status: true, _count: { select: { projectPlans: true } } } });
  if (version && version.status !== 'PUBLISHED') {
    if (version._count.projectPlans > 0) throw new Error(`Cannot rebuild ${SOP_VERSION}: it is already used by projects`);
    await prisma.sopVersion.delete({ where: { id: version.id } });
    version = null;
  }
  const versionId = version?.id ?? (await createVersion(prisma, template.id));
  await validateVersion(prisma, versionId);
  if (!uploaderUserId) {
    console.warn(`[seed] ${SOP_CODE} ${SOP_VERSION} created; template files skipped because no active administrator is available`);
    return;
  }
  const items = await prisma.sopDeliverable.findMany({ where: { task: { stage: { sopVersionId: versionId } } }, select: { id: true, stableKey: true } });
  const byKey = new Map(items.map((item) => [item.stableKey, item.id]));
  for (const item of deliverables) {
    const id = byKey.get(item.key);
    if (!id) throw new Error(`Missing preloaded deliverable: ${item.name}`);
    for (const file of item.files) await materializeFile(prisma, uploaderUserId, id, file);
  }
}

export const PIS_IMPLEMENTATION_SOP_CODE = SOP_CODE;
export const PIS_IMPLEMENTATION_SOP_VERSION = SOP_VERSION;
