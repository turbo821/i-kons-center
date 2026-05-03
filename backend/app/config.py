import os

class Config:
    SQLALCHEMY_DATABASE_URI = "postgresql://postgres:postgres@localhost:5432/infocenter" # os.getenv("DATABASE_URL")

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = "sD51e-s21fr4-keU"

    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60