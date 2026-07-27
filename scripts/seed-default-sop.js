require('dotenv').config();
const { getPool, mysqlConfigured } = require('../db');

const template = {
  name: '标准实施SOP', version: 'V1.0', status: '已发布',
  stages: [
    { id: 'stage_prepare', name: '事前准备', weight: 30, duration: 10, tasks: [
      { id: 'task_research', name: '项目调研', description: '梳理软硬件接口、业务流程及报告模板', owner: '项目经理', duration: 5, weight: 25 },
      { id: 'task_environment', name: '系统环境搭建', description: '完成服务器、网络和基础环境验证', owner: '运维组', duration: 5, weight: 25 }
    ]},
    { id: 'stage_interface', name: '接口对接', weight: 40, duration: 10, tasks: [
      { id: 'task_doc', name: '接口文档确认', description: '确认接口范围、字段、协议和异常机制', owner: '接口工程师', duration: 5, weight: 20 },
      { id: 'task_dev', name: '接口开发及调试', description: '完成开发、联调测试与问题整改', owner: '研发工程师', duration: 15, weight: 40 },
      { id: 'task_accept', name: '接口验收', description: '完成功能、数据、性能与稳定性验收', owner: '项目经理', duration: 5, weight: 20 }
    ]},
    { id: 'stage_trial', name: '上线试运行', weight: 30, duration: 10, tasks: [
      { id: 'task_fulltest', name: '全流程内测', description: '开展全业务验证并完成问题闭环', owner: '实施工程师', duration: 7, weight: 25 },
      { id: 'task_cutover', name: '上线切换', description: '完成上线切换、监控和应急处置', owner: '项目经理', duration: 3, weight: 25 }
    ]}
  ]
};

async function main() {
  if (!mysqlConfigured()) throw new Error('请先配置 MySQL');
  const pool = getPool();
  await pool.execute('INSERT INTO sop_templates (id,name,version,status,template_json) VALUES (1,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),version=VALUES(version),status=VALUES(status),template_json=VALUES(template_json)', [template.name, template.version, template.status, JSON.stringify(template)]);
  await pool.end(); console.log('默认 SOP 模板已写入 MySQL');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
