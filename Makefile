include $(wildcard .env)
export

.PHONY: dev-db dev-api dev-web web build test test-integration lint up down release

dev-db: ## Start PostGIS only
	docker compose up -d db

dev-api: ## Run the API locally (serves the last frontend build)
	go run ./cmd/api

dev-web: ## Vite dev server with /api proxied to :8080
	cd web && pnpm dev

web: ## Build the frontend into web/dist (embedded in the Go binary)
	cd web && pnpm install --frozen-lockfile && pnpm build

build: web ## Build the single binary
	go build -o bin/api ./cmd/api

test:
	go test ./...

test-integration: ## Needs `make dev-db`
	TEST_DATABASE_URL=$(DATABASE_URL) go test -tags integration ./internal/infrastructure/postgres/

lint:
	go vet ./...
	cd web && pnpm lint

up: ## Build and run app + db
	docker compose up --build -d

down:
	docker compose down

release: ## Bump, commit, tag and push a release (BUMP=patch|minor|major|X.Y.Z)
	scripts/release.sh $(BUMP)
