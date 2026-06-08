-- Базовые роли системы.
-- В системе действует только одна глобальная роль — admin.
-- Роли viewer и expert существуют как роли ВНУТРИ ролевой группы и
-- хранятся в таблице user_group_memberships, а не в таблице roles.
INSERT INTO roles (name, description) VALUES
    ('admin', 'Администратор системы')
ON CONFLICT (name) DO NOTHING;
