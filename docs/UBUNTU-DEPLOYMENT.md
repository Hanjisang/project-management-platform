# Ubuntu 服务器部署路径与操作手册

> 适用系统：Ubuntu Server 22.04 LTS / 24.04 LTS  
> 推荐部署方式：Docker Compose  
> GitHub 仓库：`https://github.com/Hanjisang/project-management-platform.git`

## 1. 服务器路径约定

生产服务器统一使用以下目录：

| 用途 | Ubuntu 路径 | 说明 |
| --- | --- | --- |
| 项目代码 | `/opt/project-management-platform` | Git 仓库工作目录 |
| 部署环境变量 | `/opt/project-management-platform/.env.deploy` | 密码、JWT 密钥及第三方凭证，不提交 Git |
| Compose 文件 | `/opt/project-management-platform/docker-compose.yml` | 应用和 MySQL 编排配置 |
| Nginx 配置 | `/etc/nginx/sites-available/project-management-platform` | 反向代理配置 |
| Nginx 启用链接 | `/etc/nginx/sites-enabled/project-management-platform` | 指向 sites-available |
| 备份目录 | `/srv/backups/project-management-platform` | 数据库和上传文件备份 |
| 部署日志 | `/var/log/project-management-platform` | 人工部署/备份脚本日志目录 |

Docker 数据默认保存在 Docker 管理的命名卷中：

- `mysql_data`：MySQL 数据目录。
- `app_uploads`：应用上传文件目录，对应容器内 `/app/data/uploads`。

不要直接修改 `/var/lib/docker/volumes` 下的内容。备份和恢复应通过 MySQL 导出及临时容器读取命名卷完成。

## 2. 首次安装系统依赖

```bash
sudo apt update
sudo apt install -y ca-certificates curl git nginx

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker nginx
```

验证：

```bash
sudo docker version
sudo docker compose version
```

## 3. 创建目录并拉取代码

```bash
sudo mkdir -p /opt/project-management-platform
sudo chown "$USER":"$USER" /opt/project-management-platform

git clone \
  --branch fix/round1-technical-audit \
  https://github.com/Hanjisang/project-management-platform.git \
  /opt/project-management-platform

cd /opt/project-management-platform
```

当前审计代码位于 `fix/round1-technical-audit` 分支。在 Pull Request 合并到 `main` 后，生产环境应改为部署 `main` 或正式版本标签，不应长期固定在功能分支。

## 4. 配置生产环境变量

```bash
cd /opt/project-management-platform
cp .env.deploy.example .env.deploy
chmod 600 .env.deploy
nano .env.deploy
```

必须替换：

- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- `JWT_SECRET`（至少 32 个随机字符）
- `DEFAULT_ADMIN_PASSWORD`

可用以下命令生成随机密钥：

```bash
openssl rand -base64 48
```

`.env.deploy` 包含真实凭证，禁止提交到 GitHub、发送到聊天工具或写入部署文档。

## 5. 启动应用

```bash
cd /opt/project-management-platform
sudo docker compose --env-file .env.deploy up -d --build
```

容器启动顺序：

1. MySQL 启动并通过 healthcheck。
2. 应用执行 `scripts/migrate-round1-technical-audit.js`。
3. 应用执行 `scripts/ensure-admin.js`。
4. 应用启动 `server.js`，监听容器端口 3030。

查看状态与日志：

```bash
sudo docker compose --env-file .env.deploy ps
sudo docker compose --env-file .env.deploy logs --tail=200 app
sudo docker compose --env-file .env.deploy logs --tail=200 mysql
curl -fsS http://127.0.0.1:3030/api/health
```

如果迁移版本缺失，应用会明确提示执行 `npm run db:migrate-round1`；Dockerfile 的正式启动命令已经在启动服务前自动执行该迁移。

## 6. 配置 Nginx 反向代理

创建 `/etc/nginx/sites-available/project-management-platform`：

```nginx
server {
    listen 80;
    server_name your-domain.example.com;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3030;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/project-management-platform \
  /etc/nginx/sites-enabled/project-management-platform
sudo nginx -t
sudo systemctl reload nginx
```

生产环境必须配置 HTTPS。可使用 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example.com
```

启用 HTTPS 后，在 Compose 的应用环境变量中设置 `COOKIE_SECURE: "true"`，然后重建应用容器。

## 7. 防火墙建议

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

不建议把 MySQL 3306 暴露到公网。应用端口 3030 也应仅监听本机或通过云安全组限制，只由 Nginx 对外提供服务。

## 8. 日常更新

```bash
cd /opt/project-management-platform
git fetch origin
git pull --ff-only origin fix/round1-technical-audit
sudo docker compose --env-file .env.deploy up -d --build
sudo docker compose --env-file .env.deploy ps
curl -fsS http://127.0.0.1:3030/api/health
```

合并到 `main` 后，将更新命令中的分支替换为 `main`。生产部署前应查看变更说明和数据库迁移说明，并先完成备份。

## 9. 备份

创建备份目录：

```bash
sudo mkdir -p /srv/backups/project-management-platform
sudo chmod 700 /srv/backups/project-management-platform
```

数据库备份示例：

```bash
cd /opt/project-management-platform
set -a
. ./.env.deploy
set +a

sudo docker compose --env-file .env.deploy exec -T mysql \
  mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction --routines --triggers pis_delivery \
  | gzip > "/srv/backups/project-management-platform/mysql-$(date +%F-%H%M%S).sql.gz"
```

上传文件卷备份示例：

```bash
sudo docker run --rm \
  -v project-management-platform_app_uploads:/source:ro \
  -v /srv/backups/project-management-platform:/backup \
  alpine sh -c 'tar -czf /backup/uploads-$(date +%F-%H%M%S).tar.gz -C /source .'
```

实际卷名可通过 `sudo docker volume ls` 确认。恢复前必须先在非生产环境验证备份可读性和恢复流程。

## 10. 回滚

应用代码回滚：

```bash
cd /opt/project-management-platform
git log --oneline -10
git switch --detach <已验证的提交SHA>
sudo docker compose --env-file .env.deploy up -d --build
```

数据库迁移目前没有自动向下回滚脚本。涉及结构变更时，回滚步骤必须依据 PR 的迁移说明执行，并优先从部署前备份恢复到独立数据库验证。不要直接在生产库尝试未经验证的逆向 SQL。

## 11. 故障排查

```bash
cd /opt/project-management-platform
sudo docker compose --env-file .env.deploy ps
sudo docker compose --env-file .env.deploy logs --tail=300 app
sudo docker compose --env-file .env.deploy logs --tail=300 mysql
sudo nginx -t
sudo journalctl -u nginx --since "30 minutes ago"
df -h
free -h
```

常见问题：

- MySQL healthcheck 失败：检查 `.env.deploy` 密码、磁盘空间和 MySQL 日志。
- 提示缺少迁移：检查应用日志中的迁移错误，确认数据库账号具有所需 DDL 权限。
- 登录后 Cookie 无效：确认 HTTPS、反向代理头和 `COOKIE_SECURE` 配置一致。
- 上传失败：检查 `app_uploads` 卷、磁盘空间和容器目录权限。
- 502：确认应用容器健康、3030 端口映射和 Nginx `proxy_pass`。

## 12. 发布验收清单

- [ ] 服务器仅开放 SSH、HTTP 和 HTTPS 必需端口。
- [ ] `.env.deploy` 权限为 600，且未进入 Git。
- [ ] MySQL 未暴露公网。
- [ ] 迁移成功，应用启动无 schema 版本错误。
- [ ] `/api/health` 返回成功。
- [ ] 管理员可登录并立即修改初始密码。
- [ ] 普通用户无法访问其他项目数据。
- [ ] 文档上传、下载及删除补偿流程已验证。
- [ ] 消息确认事务、幂等和权限已在真实 MySQL 验证。
- [ ] Nginx HTTPS 和安全 Cookie 已启用。
- [ ] 数据库与上传文件备份已执行并验证可恢复。

