# API 设计

统一响应、认证、分页、错误码及资源列表见 [API.md](API.md)。实现代码按领域位于 `apps/api/src`，Swagger 运行时文档位于 `/api/docs`。

Controller 只解析 HTTP/DTO 并调用 Service；领域校验和事务位于 Service；Projects/Users 等核心模块使用 Repository 封装 Prisma 查询。所有业务路由使用 `/api/v2`，外部回调位于 integrations 域并单独验签。
