import { randomBytes } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { LocalStorageProvider } from '../src/documents/local-storage.provider';
import type { StorageProvider, StoredObject } from '../src/documents/storage.provider';

export const IMPLEMENTATION_SOP_CODE = 'PATHOLOGY_IMPLEMENTATION_STANDARD';
export const IMPLEMENTATION_SOP_VERSION = 'V1.9.1';

const SYSTEM_UPLOADER_USERNAME = 'system-seed';
const SYSTEM_UPLOADER_DISPLAY_NAME = '系统预置';
const TEMPLATE_NAME = '病理信息化项目实施标准SOP';
const TEMPLATE_DESCRIPTION =
  '病理信息化项目实施全生命周期标准流程，用于项目计划生成、执行检查、正式交付物管理、上线控制及项目验收交付。';
const VERSION_DESCRIPTION =
  '依据《实施全生命周期 SOP 管理规范》V1.9.1 预置。前五阶段共 17 个逻辑交付项；默认工期仅用于初始化，项目启动时应按实际情况调整。';

const MIME_TYPES: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
};

type ChecklistSeed = { name: string; required?: boolean };
type TaskSeed = {
  stableKey: string;
  checklistCode: string;
  name: string;
  description: string;
  required?: boolean;
  checklist: ChecklistSeed[];
};
type StageSeed = {
  stableKey: string;
  name: string;
  description: string;
  defaultDurationDays: number;
  weight: number;
  tasks: TaskSeed[];
};
type AssetSeed = { relativePath: string; fileName: string };
type DeliverableSeed = {
  stableKey: string;
  taskKey: string;
  criterionKey: string;
  name: string;
  description: string;
  required: boolean;
  templates: AssetSeed[];
};
type PreparedAsset = AssetSeed & {
  content: Buffer;
  mimeType: string;
  stored: StoredObject;
};

const checklist = (...names: Array<string | [string, boolean]>): ChecklistSeed[] =>
  names.map((item) =>
    Array.isArray(item) ? { name: item[0], required: item[1] } : { name: item },
  );

const task = (
  stableKey: string,
  checklistCode: string,
  name: string,
  description: string,
  checks: ChecklistSeed[],
  required = true,
): TaskSeed => ({ stableKey, checklistCode, name, description, required, checklist: checks });

const STAGES: StageSeed[] = [
  {
    stableKey: 'STAGE_ADMISSION',
    name: '01 事前准备',
    description:
      '调研、三方确认、条件准备、进场准入与项目启动。范围、条件、调研、方案、计划及接口信息明确，准入通过并完成启动会后进入实施执行。',
    defaultDurationDays: 9,
    weight: 20,
    tasks: [
      task(
        'TASK_PROJECT_INTAKE',
        'S1T1',
        '项目接收与基础调研',
        '梳理项目类型、现用 PIS/HIS、病理业务范围、业务量、设备人员、信息化环境以及上线、培训和验收安排。',
        checklist(
          '项目类型及现用 PIS/HIS 已确认',
          '病理业务范围、业务量、设备及人员已调研',
          '信息化环境及计划上线/切换时间已确认',
          '培训与验收安排已初步确认',
        ),
      ),
      task(
        'TASK_SCOPE_BASELINE',
        'S1T2',
        '范围及交付边界',
        '以双方确认的标准版本和接口清单作为交付基线，个性化功能、分子业务、历史数据迁移及专项内容单独评估。',
        checklist(
          '标准版本及系统功能范围已确认',
          '接口清单已作为交付基线确认',
          '个性化、分子业务及专项内容已单独识别',
          '历史数据迁移范围已明确',
        ),
      ),
      task(
        'TASK_TRIPARTITE_PREP',
        'S1T3',
        '三方准备与协同确认',
        '组织病理科、信息科、HIS/体检等第三方及公司团队沟通，确认业务流程、数据流向、联调窗口、责任人与未决事项。',
        checklist(
          '病理科、信息科及第三方参与人员已确认',
          '业务流程和数据流向已确认',
          '联调窗口及各方责任人已确认',
          '未决事项已登记并明确跟进责任',
        ),
      ),
      task(
        'TASK_INTERFACE_PREREQUISITES',
        'S1T4',
        '接口与第三方条件',
        '确认接口文档来源、日期和版本，并锁定实际参与联调的技术工程师及时间窗口。',
        checklist(
          '接口范围、文档来源、日期及版本已确认',
          '第三方实际联调工程师已确认',
          '第三方联调时间窗口已落实',
        ),
      ),
      task(
        'TASK_HOSPITAL_ENVIRONMENT',
        'S1T5',
        '院方环境与测试条件',
        '核验服务器、网络、数据库、远程访问、账号权限、测试数据、HIS 实际测试能力及病理科业务骨干。',
        checklist(
          '服务器、网络/IP/端口及防火墙条件已准备',
          '数据库、远程访问及关键账号权限已准备',
          '测试数据及 HIS/第三方实际测试条件已具备',
          '病理科关键业务人员已落实',
        ),
      ),
      task(
        'TASK_REPLACEMENT_ASSESSMENT',
        'S1T6',
        '替换项目专项核查',
        '替换项目核查原 PIS、数据库和基础数据，明确历史数据迁移、报告查询、病理号衔接及原系统完整备份条件。',
        checklist(
          ['原 PIS 版本、数据库及基础数据已核查', false],
          ['历史数据迁移范围和报告查询方式已明确', false],
          ['病理号衔接规则已确认', false],
          ['原系统完整备份条件已确认', false],
        ),
        false,
      ),
      task(
        'TASK_INTERNAL_PREPARATION',
        'S1T7',
        '内部实施准备',
        '完成项目计划、实施方案、风险说明和资源安排，使必要开发、自测、上线安排和风险应对具备条件。',
        checklist(
          '项目实施计划已编制',
          '项目实施方案已编制',
          '项目风险及应对措施已明确',
          '实施资源与必要开发、自测和上线安排已落实',
        ),
      ),
      task(
        'TASK_ENTRY_REVIEW',
        'S1T8',
        '进场准入评审',
        '依据进场红线形成“具备进场条件 / 有条件进场 / 暂不具备进场条件”的明确结论，红线项不得绕过。',
        checklist(
          '项目范围已明确',
          '第三方技术人员及联调窗口已落实',
          '接口文档完整且与实际版本一致',
          '服务器、网络及关键账号权限已准备',
          '测试数据及 HIS/第三方实际测试条件已具备',
          ['替换项目历史数据范围及完整备份条件已确认', false],
          '进场准入结论已记录',
        ),
      ),
      task(
        'TASK_PROJECT_KICKOFF',
        'S1T9',
        '项目启动会',
        '准入通过后召开项目启动会，确认目标、范围、分工、计划、里程碑、近期安排、沟通机制、升级路径与风险。',
        checklist(
          '甲乙双方及必要第三方参会人员已落实',
          '项目目标与范围已确认',
          '责任分工、实施计划和关键里程碑已确认',
          '沟通机制及问题升级路径已建立',
          '启动会结论和待办已形成会议纪要',
        ),
      ),
    ],
  },
  {
    stableKey: 'STAGE_IMPLEMENTATION',
    name: '02 实施执行',
    description:
      '完成环境、配置、接口、数据、测试与培训，形成关键实施记录并消除阻塞业务试行的重大问题。',
    defaultDurationDays: 16,
    weight: 30,
    tasks: [
      task(
        'TASK_ENVIRONMENT_SETUP',
        'S2T1',
        '系统环境搭建',
        '完成服务器、数据库、中间件、应用服务部署，配置访问、证书、端口、备份和日志策略，并验证客户端及外设。',
        checklist(
          '服务器、数据库、中间件及应用服务部署完成',
          '访问地址、证书、端口配置完成',
          '备份及日志策略已配置',
          '客户端及外设访问验证通过',
          '基础服务启动和系统访问正常',
        ),
      ),
      task(
        'TASK_SYSTEM_INITIALIZATION',
        'S2T2',
        '系统初始化配置',
        '初始化组织科室、用户角色、权限、业务字典、编号规则、流程节点、系统参数、报告模板、标签和打印模板。',
        checklist(
          '组织科室、用户角色及权限初始化完成',
          '业务字典、编号规则及流程节点配置完成',
          '系统参数配置完成',
          '报告模板、标签及打印模板配置完成',
          '基础数据核对通过',
        ),
      ),
      task(
        'TASK_INTERFACE_DESIGN',
        'S2T3',
        '接口文档与时序确认',
        '明确接口范围、调用方向、字段字典、协议认证、异常补偿、日志要求、触发条件与交互时序。',
        checklist(
          '接口范围和调用方向已确认',
          '字段字典、协议及认证方式已确认',
          '触发条件和交互时序已确认',
          '异常补偿和日志要求已确认',
        ),
      ),
      task(
        'TASK_INTERFACE_INTEGRATION',
        'S2T4',
        '接口开发与联调',
        '完成接口开发/配置、单接口测试、业务场景联调、异常/重复/超时验证和问题回归。',
        checklist(
          '接口开发或配置完成',
          '基础字典同步正常',
          '申请单及核心业务链路正常',
          '收费/退费及状态回传链路正常',
          '报告回传链路正常',
          '异常、重复和超时场景验证完成',
          '联调问题已完成回归验证',
        ),
      ),
      task(
        'TASK_DATA_MIGRATION',
        'S2T5',
        '数据准备与迁移',
        '明确迁移对象和字段，完成备份、清洗、转换、映射、测试迁移、正式迁移及数量/字段/关联关系核对。',
        checklist(
          '迁移对象、字段及范围已确认',
          '迁移前完整备份已完成',
          '清洗、转换和映射规则已确认',
          '测试迁移及正式迁移完成',
          '数量、字段和关联关系核对通过',
        ),
      ),
      task(
        'TASK_FUNCTION_TEST',
        'S2T6',
        '功能与集成测试',
        '验证业务申请、登记、技术流程、诊断报告、审核发布、报告回传、查询统计、异常业务、权限和备份恢复。',
        checklist(
          '申请、登记和技术流程测试通过',
          '诊断、审核发布及报告流程测试通过',
          '接口回传和查询统计测试通过',
          '异常业务场景测试通过',
          '权限安全和备份恢复验证通过',
        ),
      ),
      task(
        'TASK_USER_TRAINING',
        'S2T7',
        '用户培训',
        '按管理员、业务操作、医技、诊断、信息科等岗位开展培训和实际操作演练。',
        checklist('培训对象和时间已通知', '分岗位培训及操作演练已完成', '培训签到记录已留存'),
      ),
      task(
        'TASK_IMPLEMENTATION_ISSUES',
        'S2T8',
        '实施问题闭环',
        '问题统一登记、分类分级，明确责任人、处理时限、验证结果和关闭状态；范围变更必须走评审。',
        checklist(
          '实施问题已统一登记并分类分级',
          '问题责任人和处理时限已明确',
          '问题处理结果已完成验证',
          '阻塞业务试行的重大问题已关闭',
          '范围变化已进入正式评审或变更流程',
        ),
      ),
    ],
  },
  {
    stableKey: 'STAGE_TRIAL',
    name: '03 试行验证',
    description:
      '以真实或准真实业务验证功能、接口、数据、设备和人员操作，关闭上线前问题并形成上线判断依据。',
    defaultDurationDays: 12,
    weight: 20,
    tasks: [
      task(
        'TASK_TRIAL_PLAN',
        'S3T1',
        '试行方案制定',
        '明确试点科室、业务范围、参与人员、试行周期、数据口径、问题反馈渠道和退出/暂停条件。',
        checklist(
          '试点科室和业务范围已确认',
          '参与人员及试行周期已确认',
          '数据口径和问题反馈渠道已明确',
          '退出或暂停条件已明确',
        ),
      ),
      task(
        'TASK_TRIAL_OPERATION',
        'S3T2',
        '真实业务运行',
        '使用真实业务数据运行，从申请、登记、技术处理、诊断、审核到报告回传形成完整闭环。',
        checklist(
          '真实或准真实业务数据已投入试运行',
          '申请和登记流程通过',
          '技术处理、诊断和审核流程通过',
          '报告回传形成完整业务闭环',
        ),
      ),
      task(
        'TASK_FLOW_VALIDATION',
        'S3T3',
        '流程与功能验证',
        '验证权限、模板、标签打印、外设、接口状态、异常业务、补退费和历史查询等关键场景。',
        checklist(
          '权限、报告模板和标签打印验证通过',
          '外设及接口状态验证通过',
          '异常业务及补退费场景验证通过',
          '历史查询场景验证通过',
        ),
      ),
      task(
        'TASK_PERFORMANCE_OBSERVE',
        'S3T4',
        '运行与性能观察',
        '观察系统稳定性、页面响应、接口成功率、数据准确性、报告回传和用户操作效率。',
        checklist(
          '系统稳定性和页面响应满足试运行要求',
          '接口成功率和报告回传情况已观察',
          '数据准确性已核验',
          '用户操作效率和反馈已记录',
        ),
      ),
      task(
        'TASK_REQUIREMENT_COLLECTION',
        'S3T5',
        '需求及问题收集与整改',
        '持续维护需求清单，统一登记试运行问题，完成分级处理和回归验证。',
        checklist(
          '需求及问题已持续登记',
          '需求和问题已分类分级',
          '阻断问题已关闭',
          '整改结果已完成回归验证',
        ),
      ),
      task(
        'TASK_GO_LIVE_ASSESSMENT',
        'S3T6',
        '上线条件评估（含上线前核验）',
        '实施逐项核验生产环境、正式版本、数据库脚本、关键接口、核心功能、测试、培训、备份及应急/回退方案，由项目经理确认。',
        checklist(
          '生产环境、服务器、网络及账号权限已核验',
          '正式版本及数据库脚本已确认',
          '关键接口及核心功能验证通过',
          'P0/P1 问题已关闭且不存在未受控上线阻塞项',
          '测试结论及必要培训已完成',
          '备份、应急及回退方案已确认',
          '院方及项目经理上线确认已完成',
        ),
      ),
    ],
  },
  {
    stableKey: 'STAGE_GO_LIVE',
    name: '04 上线切换',
    description:
      '依据上线条件评估结论，按既定方案完成生产部署、数据/接口切换、核心业务验证和上线保障。',
    defaultDurationDays: 6,
    weight: 20,
    tasks: [
      task(
        'TASK_GO_LIVE_PLAN',
        'S4T1',
        '上线方案与组织',
        '明确上线日期、切换窗口、系统版本、人员分工、数据迁移/同步、接口切换、业务暂停和保障安排。',
        checklist(
          '上线日期、切换窗口和系统版本已确认',
          '上线人员分工和联系方式已确认',
          '数据迁移/同步及接口切换步骤已明确',
          '业务暂停及现场/远程保障安排已明确',
        ),
      ),
      task(
        'TASK_BACKUP_FREEZE',
        'S4T2',
        '生产备份与冻结',
        '上线前完成程序、数据库及关键配置备份，确认版本冻结、变更窗口和回退基线。',
        checklist(
          '程序、数据库及关键配置备份完成',
          '上线版本已冻结',
          '生产变更窗口已确认',
          '回退基线已确认',
        ),
      ),
      task(
        'TASK_PRODUCTION_SWITCH',
        'S4T3',
        '正式部署与切换',
        '执行生产部署、数据库升级、正式数据迁移/增量同步、生产接口切换、客户端及设备配置。',
        checklist(
          '上线通知已完成',
          '生产部署和数据库升级已完成',
          '正式数据迁移或增量同步已完成',
          '生产接口切换完成',
          '客户端及设备配置完成',
        ),
      ),
      task(
        'TASK_POST_SWITCH_VERIFY',
        'S4T4',
        '上线后快速验证',
        '验证用户登录、核心业务、关键接口、报告/打印、数据准确性、日志和业务状态，确认无重大异常。',
        checklist(
          '用户登录及核心业务验证通过',
          '关键接口验证通过',
          '报告与打印验证通过',
          '数据准确性、日志及业务状态验证通过',
          '未发现未受控重大异常',
        ),
      ),
      task(
        'TASK_GO_LIVE_SUPPORT',
        'S4T5',
        '上线保障与应急',
        '建立现场/远程支持与问题升级机制，优先处置 P0/P1，必要时按预案回退或启用临时应急流程。',
        checklist(
          '现场或远程支持渠道已建立',
          '问题升级机制和责任人已明确',
          'P0/P1 问题处置优先级已落实',
          '回退或临时应急流程可执行',
        ),
      ),
      task(
        'TASK_GO_LIVE_REPORT',
        'S4T6',
        '上线记录与结果确认',
        '记录实际上线过程、核心验证证据、异常和遗留事项，形成明确上线结论并取得必要的甲方确认。',
        checklist(
          '上线切换已按方案执行',
          '核心业务与关键接口验证通过',
          '异常及遗留事项均已明确责任人和处理计划',
          '实际上线过程和验证证据已记录',
          '正式上线结论及必要甲方确认已形成',
        ),
      ),
    ],
  },
  {
    stableKey: 'STAGE_ACCEPTANCE',
    name: '05 验收交付',
    description:
      '对照合同和确认需求完成验收，关闭整改事项，完成项目资料、系统管理和后续服务责任移交。',
    defaultDurationDays: 7,
    weight: 10,
    tasks: [
      task(
        'TASK_ACCEPTANCE_PREP',
        'S5T1',
        '验收准备',
        '对照合同和确认需求梳理验收范围，检查功能、接口、数据、设备、培训、试运行和文档完成情况。',
        checklist(
          '合同及确认需求已完成对照',
          '验收范围已确认',
          '功能、接口、数据和设备完成情况已检查',
          '培训、试运行及文档完成情况已检查',
        ),
      ),
      task(
        'TASK_ACCEPTANCE_DOCS',
        'S5T2',
        '验收资料整理',
        '准备验收方案、合同功能对照表、测试材料、培训材料、试运行数据、项目完成情况说明和演示环境。',
        checklist(
          '验收方案及合同功能对照表已准备',
          '测试、培训和试运行材料已齐备',
          '项目完成情况说明已形成',
          '验收演示环境已准备',
        ),
      ),
      task(
        'TASK_ACCEPTANCE_TEST',
        'S5T3',
        '验收测试',
        '验证功能、业务流程、接口、数据准确性、性能稳定性、权限安全、报表统计、设备和文档完整性。',
        checklist(
          '功能和核心业务流程验收测试通过',
          '接口及数据准确性验收测试通过',
          '性能稳定性和权限安全验证通过',
          '报表统计、设备和文档完整性验证通过',
        ),
      ),
      task(
        'TASK_ACCEPTANCE_REVIEW',
        'S5T4',
        '验收评审',
        '汇报项目建设情况，演示核心流程，说明试运行、接口数据、培训和遗留问题，形成正式验收意见。',
        checklist(
          '项目建设情况和核心流程已汇报演示',
          '试运行、接口数据和培训情况已说明',
          '遗留问题及责任已明确',
          '验收会议完成并形成正式验收意见',
        ),
      ),
      task(
        'TASK_ACCEPTANCE_REMEDIATION',
        'S5T5',
        '验收问题整改',
        '对验收意见分类，明确责任人和完成时间，完成修复、验证、整改说明及关闭确认。',
        checklist(
          '验收意见已分类并明确责任人',
          '整改完成时间已确认',
          '整改项已完成修复和验证',
          '整改说明及关闭确认已形成',
        ),
      ),
      task(
        'TASK_DOCUMENT_HANDOVER',
        'S5T6',
        '项目资料交付',
        '移交部署包、数据库脚本、配置、接口文档、用户/管理员/运维手册、测试培训材料、版本记录和备份恢复方案。',
        checklist(
          '程序/部署包、数据库脚本及配置已移交',
          '接口文档及用户/管理员/运维手册已移交',
          '测试和培训材料已移交',
          '版本记录及备份恢复方案已移交',
        ),
      ),
      task(
        'TASK_HANDOVER_CONFIRM',
        'S5T7',
        '交付与后续责任确认',
        '通过项目交付清单明确最终资料、接收状态、归档路径和遗留事项责任，并确认后续运维边界。',
        checklist(
          '正式验收结论已经形成',
          '项目交付清单已完成',
          '项目资料已完成移交和签收',
          '项目归档路径已明确',
          '遗留事项已纳入后续跟踪并明确责任',
          '后续运维边界已确认',
        ),
      ),
    ],
  },
];

const DELIVERABLES: DeliverableSeed[] = [
  {
    stableKey: 'DELIV_RESEARCH_REPORT',
    taskKey: 'TASK_PROJECT_INTAKE',
    criterionKey: 'CRIT_D01_CONTENT',
    name: '项目调研报告',
    description: '记录项目现状、流程、需求、接口、环境、风险及待确认事项。',
    required: true,
    templates: [
      {
        relativePath: '01_事前准备/项目调研报告_标准模板_V1.0.docx',
        fileName: '项目调研报告_标准模板_V1.0.docx',
      },
    ],
  },
  {
    stableKey: 'DELIV_HW_INTERFACE_LIST',
    taskKey: 'TASK_INTERFACE_PREREQUISITES',
    criterionKey: 'CRIT_D02_CONTENT',
    name: '软硬件及接口清单',
    description: '记录服务器、终端、软件、网络、设备及系统接口基础信息。',
    required: true,
    templates: [
      {
        relativePath: '01_事前准备/软硬件及接口清单_标准模板_V1.0.xlsx',
        fileName: '软硬件及接口清单_标准模板_V1.0.xlsx',
      },
    ],
  },
  {
    stableKey: 'DELIV_PROJECT_PLAN',
    taskKey: 'TASK_INTERNAL_PREPARATION',
    criterionKey: 'CRIT_D03_CONTENT',
    name: '项目计划',
    description: '明确任务、里程碑、责任人、计划时间及交付节点。',
    required: true,
    templates: [
      {
        relativePath: '01_事前准备/项目计划_标准模板_V1.0.xlsx',
        fileName: '项目计划_标准模板_V1.0.xlsx',
      },
    ],
  },
  {
    stableKey: 'DELIV_IMPLEMENTATION_PLAN',
    taskKey: 'TASK_INTERNAL_PREPARATION',
    criterionKey: 'CRIT_D04_CONTENT',
    name: '项目实施方案',
    description: '明确实施范围、方法、组织分工、进度、风险及保障措施。',
    required: true,
    templates: [
      {
        relativePath: '01_事前准备/项目实施方案_标准模板_V1.0.docx',
        fileName: '项目实施方案_标准模板_V1.0.docx',
      },
    ],
  },
  {
    stableKey: 'DELIV_ENTRY_CHECK',
    taskKey: 'TASK_ENTRY_REVIEW',
    criterionKey: 'CRIT_D05_CONTENT',
    name: '进场条件核查表',
    description: '核查项目进场前的现场环境、资源、人员及配合条件。',
    required: true,
    templates: [
      {
        relativePath: '01_事前准备/进场条件核查表_标准模板_V1.0.docx',
        fileName: '进场条件核查表_标准模板_V1.0.docx',
      },
    ],
  },
  {
    stableKey: 'DELIV_HOSPITAL_CONFIRM',
    taskKey: 'TASK_ENTRY_REVIEW',
    criterionKey: 'CRIT_D06_CONTENT',
    name: '院方确认函',
    description:
      '明确院方项目范围、配合事项及确认要求。正式 SOP 指定与进场条件核查表共用销售配合通知承载，但本次正式套表包未提供该通知书模板。',
    required: true,
    templates: [],
  },
  {
    stableKey: 'DELIV_MEETING_MINUTES',
    taskKey: 'TASK_PROJECT_KICKOFF',
    criterionKey: 'CRIT_D07_CONTENT',
    name: '三方会议纪要',
    description: '记录甲乙双方及第三方就范围、计划、责任和待办形成的共识。',
    required: false,
    templates: [
      {
        relativePath: '01_事前准备/三方会议纪要_标准模板_V1.0.docx',
        fileName: '三方会议纪要_标准模板_V1.0.docx',
      },
    ],
  },
  {
    stableKey: 'DELIV_DEPLOYMENT_CONFIRM',
    taskKey: 'TASK_ENVIRONMENT_SETUP',
    criterionKey: 'CRIT_D08_CONTENT',
    name: '系统部署配置确认单',
    description: '记录部署环境、系统版本、基础配置、基础数据及核查结果。',
    required: true,
    templates: [
      {
        relativePath: '02_实施执行/系统部署配置确认单_标准模板_V1.0.xlsx',
        fileName: '系统部署配置确认单_标准模板_V1.0.xlsx',
      },
    ],
  },
  {
    stableKey: 'DELIV_INTERFACE_CONFIRM',
    taskKey: 'TASK_INTERFACE_INTEGRATION',
    criterionKey: 'CRIT_D09_CONTENT',
    name: '软硬件接口联调确认表',
    description: '记录联调范围、测试结果、问题、遗留事项及确认情况。',
    required: true,
    templates: [
      {
        relativePath: '02_实施执行/软硬件接口联调确认表_标准模板_V1.0.xlsx',
        fileName: '软硬件接口联调确认表_标准模板_V1.0.xlsx',
      },
    ],
  },
  {
    stableKey: 'DELIV_TRAINING_SIGNIN',
    taskKey: 'TASK_USER_TRAINING',
    criterionKey: 'CRIT_D10_CONTENT',
    name: '培训签到表',
    description: '记录培训主题、时间、地点、参训人员及签名。',
    required: true,
    templates: [
      {
        relativePath: '02_实施执行/培训签到表_标准模板_V1.0.docx',
        fileName: '培训签到表_标准模板_V1.0.docx',
      },
    ],
  },
  {
    stableKey: 'DELIV_TRIAL_REPORT',
    taskKey: 'TASK_TRIAL_OPERATION',
    criterionKey: 'CRIT_D11_CONTENT',
    name: '试运行报告',
    description: '汇总试运行范围、运行情况、问题、遗留事项及结论。',
    required: true,
    templates: [
      {
        relativePath: '03_试行验证/试运行报告_标准模板_V1.0.docx',
        fileName: '试运行报告_标准模板_V1.0.docx',
      },
    ],
  },
  {
    stableKey: 'DELIV_REQUIREMENT_LIST',
    taskKey: 'TASK_REQUIREMENT_COLLECTION',
    criterionKey: 'CRIT_D12_CONTENT',
    name: '需求清单',
    description: '记录需求内容、优先级、责任人、处理状态及验收情况。',
    required: false,
    templates: [
      {
        relativePath: '03_试行验证/需求清单_标准模板_V1.0.xlsx',
        fileName: '需求清单_标准模板_V1.0.xlsx',
      },
    ],
  },
  {
    stableKey: 'DELIV_GO_LIVE_ASSESSMENT',
    taskKey: 'TASK_GO_LIVE_ASSESSMENT',
    criterionKey: 'CRIT_D13_CONTENT',
    name: '上线条件评估表',
    description: '逐项核验上线准备，汇总阻塞项、待确认项和上线建议。',
    required: true,
    templates: [
      {
        relativePath: '03_试行验证/上线条件评估表_标准模板_V1.0.xlsx',
        fileName: '上线条件评估表_标准模板_V1.0.xlsx',
      },
    ],
  },
  {
    stableKey: 'DELIV_GO_LIVE_PLAN',
    taskKey: 'TASK_GO_LIVE_PLAN',
    criterionKey: 'CRIT_D14_CONTENT',
    name: '上线实施方案',
    description: '明确生产切换范围、窗口、步骤、人员、验证、应急和回退安排。',
    required: true,
    templates: [
      {
        relativePath: '04_上线切换/上线实施方案_标准模板_V1.0.docx',
        fileName: '上线实施方案_标准模板_V1.0.docx',
      },
      {
        relativePath: '04_上线切换/上线实施方案_儿童医院.docx',
        fileName: '上线实施方案_儿童医院.docx',
      },
    ],
  },
  {
    stableKey: 'DELIV_GO_LIVE_REPORT',
    taskKey: 'TASK_GO_LIVE_REPORT',
    criterionKey: 'CRIT_D15_CONTENT',
    name: '上线报告',
    description: '记录实际上线过程、验证证据、异常、遗留事项及上线结论。',
    required: true,
    templates: [
      {
        relativePath: '04_上线切换/上线报告_标准模板_V1.0.docx',
        fileName: '上线报告_标准模板_V1.0.docx',
      },
    ],
  },
  {
    stableKey: 'DELIV_ACCEPTANCE_REPORT',
    taskKey: 'TASK_ACCEPTANCE_REVIEW',
    criterionKey: 'CRIT_D16_CONTENT',
    name: '项目验收报告',
    description: '汇总建设内容、完成情况、验收范围、依据、遗留事项及结论。',
    required: true,
    templates: [
      {
        relativePath: '05_验收交付/项目验收报告_标准模板_V1.0.docx',
        fileName: '项目验收报告_标准模板_V1.0.docx',
      },
    ],
  },
  {
    stableKey: 'DELIV_HANDOVER_LIST',
    taskKey: 'TASK_HANDOVER_CONFIRM',
    criterionKey: 'CRIT_D17_CONTENT',
    name: '项目交付清单',
    description: '作为最终资料索引，记录版本、提交、接收、归档和签收情况。',
    required: true,
    templates: [
      {
        relativePath: '05_验收交付/项目交付清单_标准模板_V1.0.xlsx',
        fileName: '项目交付清单_标准模板_V1.0.xlsx',
      },
    ],
  },
];

const EXPECTED = {
  stages: STAGES.length,
  tasks: STAGES.reduce((sum, stage) => sum + stage.tasks.length, 0),
  checklist: STAGES.reduce(
    (sum, stage) => sum + stage.tasks.reduce((taskSum, item) => taskSum + item.checklist.length, 0),
    0,
  ),
  deliverables: DELIVERABLES.length,
  criteria: DELIVERABLES.length,
  templates: DELIVERABLES.reduce((sum, item) => sum + item.templates.length, 0),
};

export const IMPLEMENTATION_SOP_EXPECTED_COUNTS = EXPECTED;

function weights(count: number): number[] {
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

async function assetRoot(): Promise<string> {
  const suffix = ['prisma', 'seed-assets', 'sop', 'v1.9.1'];
  const candidates = [
    resolve(process.cwd(), ...suffix),
    resolve(process.cwd(), 'apps', 'api', ...suffix),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next supported npm workspace working directory.
    }
  }
  throw new Error(`Implementation SOP seed assets not found: ${candidates.join(', ')}`);
}

async function ensureSystemUploader(prisma: PrismaClient): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { username: SYSTEM_UPLOADER_USERNAME } });
  if (existing) {
    if (existing.status === 'ACTIVE' || existing.deletedAt)
      console.warn(
        `[seed] ${SYSTEM_UPLOADER_USERNAME} already exists with status=${existing.status}; existing user data was not overwritten`,
      );
    return existing.id;
  }
  const generatedSecret = randomBytes(48).toString('base64url');
  const created = await prisma.user.create({
    data: {
      username: SYSTEM_UPLOADER_USERNAME,
      displayName: SYSTEM_UPLOADER_DISPLAY_NAME,
      passwordHash: await bcrypt.hash(generatedSecret, 12),
      status: 'DISABLED',
    },
  });
  return created.id;
}

async function prepareAssets(storage: StorageProvider): Promise<PreparedAsset[]> {
  const root = await assetRoot();
  const assets = DELIVERABLES.flatMap((deliverable) => deliverable.templates);
  const prepared: PreparedAsset[] = [];
  try {
    for (const asset of assets) {
      const content = await readFile(resolve(root, ...asset.relativePath.split('/')));
      const mimeType = MIME_TYPES[extname(asset.fileName).toLowerCase()];
      if (!mimeType) throw new Error(`Unsupported SOP seed asset type: ${asset.fileName}`);
      const stored = await storage.put(asset.fileName, content);
      prepared.push({ ...asset, content, mimeType, stored });
    }
    return prepared;
  } catch (error) {
    await Promise.allSettled(prepared.map((asset) => storage.delete(asset.stored.objectKey)));
    throw error;
  }
}

async function createVersion(
  prisma: PrismaClient,
  templateId: string,
  uploaderId: string,
  storage: StorageProvider,
): Promise<string> {
  const prepared = await prepareAssets(storage);
  const preparedByPath = new Map(prepared.map((asset) => [asset.relativePath, asset]));
  try {
    return await prisma.$transaction(
      async (tx) => {
        const version = await tx.sopVersion.create({
          data: {
            templateId,
            version: IMPLEMENTATION_SOP_VERSION,
            status: 'PUBLISHED',
            description: VERSION_DESCRIPTION,
            publishedAt: new Date(),
          },
        });
        for (const [stageIndex, stageSeed] of STAGES.entries()) {
          const stage = await tx.sopStage.create({
            data: {
              stableKey: stageSeed.stableKey,
              sopVersionId: version.id,
              name: stageSeed.name,
              description: stageSeed.description,
              sortOrder: stageIndex,
              defaultDurationDays: stageSeed.defaultDurationDays,
              weight: stageSeed.weight,
            },
          });
          const taskWeights = weights(stageSeed.tasks.length);
          for (const [taskIndex, taskSeed] of stageSeed.tasks.entries()) {
            const sopTask = await tx.sopTask.create({
              data: {
                stableKey: taskSeed.stableKey,
                stageId: stage.id,
                name: taskSeed.name,
                description: taskSeed.description,
                sortOrder: taskIndex,
                defaultDurationDays: 1,
                weight: taskWeights[taskIndex] ?? 0,
                required: taskSeed.required ?? true,
              },
            });
            if (taskSeed.checklist.length)
              await tx.sopChecklistItem.createMany({
                data: taskSeed.checklist.map((item, index) => ({
                  stableKey: `CHECK_${taskSeed.checklistCode}_${String(index + 1).padStart(2, '0')}`,
                  taskId: sopTask.id,
                  name: item.name,
                  sortOrder: index,
                  required: item.required ?? true,
                })),
              });
            const deliverables = DELIVERABLES.filter((item) => item.taskKey === taskSeed.stableKey);
            for (const [deliverableIndex, deliverableSeed] of deliverables.entries()) {
              const templates = deliverableSeed.templates.map((asset) => {
                const found = preparedByPath.get(asset.relativePath);
                if (!found) throw new Error(`Prepared SOP asset missing: ${asset.relativePath}`);
                return {
                  fileName: found.fileName,
                  objectKey: found.stored.objectKey,
                  mimeType: found.mimeType,
                  size: found.stored.size,
                  checksum: found.stored.checksum,
                  uploadedById: uploaderId,
                };
              });
              await tx.sopDeliverable.create({
                data: {
                  stableKey: deliverableSeed.stableKey,
                  sopTaskId: sopTask.id,
                  name: deliverableSeed.name,
                  description: deliverableSeed.description,
                  required: deliverableSeed.required,
                  sortOrder: deliverableIndex,
                  reviewMode: 'HUMAN_ONLY',
                  aiReviewEnabled: false,
                  templates: { create: templates },
                  reviewCriteria: {
                    create: {
                      stableKey: deliverableSeed.criterionKey,
                      name: '内容完整且与项目事实一致',
                      description: '由人工审核确认内容完整、结论有依据且与实际项目记录一致。',
                      required: true,
                      weight: 100,
                      sortOrder: 0,
                    },
                  },
                },
              });
            }
          }
        }
        return version.id;
      },
      { timeout: 30_000 },
    );
  } catch (error) {
    await Promise.allSettled(prepared.map((asset) => storage.delete(asset.stored.objectKey)));
    throw error;
  }
}

async function versionCounts(prisma: PrismaClient, versionId: string) {
  const [stages, tasks, checklistItems, deliverables, criteria, templates] = await Promise.all([
    prisma.sopStage.count({ where: { sopVersionId: versionId } }),
    prisma.sopTask.count({ where: { stage: { sopVersionId: versionId } } }),
    prisma.sopChecklistItem.count({ where: { task: { stage: { sopVersionId: versionId } } } }),
    prisma.sopDeliverable.count({ where: { task: { stage: { sopVersionId: versionId } } } }),
    prisma.sopDeliverableReviewCriterion.count({
      where: { deliverable: { task: { stage: { sopVersionId: versionId } } } },
    }),
    prisma.sopDeliverableTemplate.count({
      where: { deliverable: { task: { stage: { sopVersionId: versionId } } } },
    }),
  ]);
  return { stages, tasks, checklist: checklistItems, deliverables, criteria, templates };
}

async function validateExistingVersion(
  prisma: PrismaClient,
  storage: StorageProvider,
  versionId: string,
): Promise<Awaited<ReturnType<typeof versionCounts>>> {
  const counts = await versionCounts(prisma, versionId);
  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (counts[key as keyof typeof counts] !== expected)
      console.warn(
        `[seed] ${IMPLEMENTATION_SOP_CODE} ${IMPLEMENTATION_SOP_VERSION} ${key} count is ${counts[key as keyof typeof counts]}, expected ${expected}; existing published data was not modified`,
      );
  }
  const templates = await prisma.sopDeliverableTemplate.findMany({
    where: { deliverable: { task: { stage: { sopVersionId: versionId } } } },
  });
  for (const template of templates) {
    try {
      const content = await storage.get(template.objectKey);
      if (BigInt(content.length) !== template.size)
        console.warn(`[seed] stored SOP template size mismatch: ${template.fileName}`);
    } catch {
      console.warn(`[seed] stored SOP template is unavailable: ${template.fileName}`);
    }
  }
  return counts;
}

export async function seedImplementationSop(
  prisma: PrismaClient,
  storage: StorageProvider = new LocalStorageProvider(new ConfigService()),
): Promise<{
  created: boolean;
  templateId: string;
  versionId: string;
  counts: Awaited<ReturnType<typeof versionCounts>>;
}> {
  const uploaderId = await ensureSystemUploader(prisma);
  const existingTemplate = await prisma.sopTemplate.findUnique({
    where: { code: IMPLEMENTATION_SOP_CODE },
  });
  const template =
    existingTemplate ??
    (await prisma.sopTemplate.create({
      data: {
        code: IMPLEMENTATION_SOP_CODE,
        name: TEMPLATE_NAME,
        description: TEMPLATE_DESCRIPTION,
      },
    }));
  const existingVersion = await prisma.sopVersion.findUnique({
    where: {
      templateId_version: { templateId: template.id, version: IMPLEMENTATION_SOP_VERSION },
    },
  });
  if (existingVersion) {
    const counts = await validateExistingVersion(prisma, storage, existingVersion.id);
    return {
      created: false,
      templateId: template.id,
      versionId: existingVersion.id,
      counts,
    };
  }
  const versionId = await createVersion(prisma, template.id, uploaderId, storage);
  const counts = await versionCounts(prisma, versionId);
  return { created: true, templateId: template.id, versionId, counts };
}
