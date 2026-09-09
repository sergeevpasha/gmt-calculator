.PHONY: up
up:
	docker compose up -d

.PHONY: down
down:
	docker compose down

.PHONY: rebuild
rebuild:
	docker compose build --no-cache --pull

.PHONY: logs
logs:
	docker compose logs -f dashboard

.PHONY: bash
bash:
	docker exec -it gmt-calculator bash
