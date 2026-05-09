-- Роли пользователей
INSERT INTO roles (name, description) VALUES
    ('admin',  'Администратор системы'),
    ('expert', 'Аналитик / эксперт'),
    ('viewer', 'Просмотр аналитики')
ON CONFLICT (name) DO NOTHING;
