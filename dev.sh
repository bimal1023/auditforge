#!/bin/bash

###############################################################################
# Arthvion Development Environment Launcher
#
# Starts:
#   1. PostgreSQL + Redis (via Docker)
#   2. FastAPI backend (uvicorn on :8000)
#   3. Celery worker (processes report & watchlist tasks)
#   4. Celery beat scheduler (triggers periodic watchlist scans)
#   5. Frontend (npm on :3000)
#
# All processes log to /tmp/arthvion-*.log
# Ctrl+C to shut everything down gracefully.
#
# SETUP:
#   1. Copy infra/.env.example → infra/.env
#   2. Fill in ANTHROPIC_API_KEY and TAVILY_API_KEY
#   3. (Optional) Get FMP_API_KEY from financialmodelingprep.com/developer
#   4. For local Stripe webhook testing:
#      - Install Stripe CLI: https://stripe.com/docs/stripe-cli
#      - Run in another terminal: stripe listen --forward-to localhost:8000/api/v1/billing/webhook
#      - It prints a signing secret; add STRIPE_WEBHOOK_SECRET to infra/.env
###############################################################################

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="${REPO_ROOT}/.venv"
LOG_DIR="/tmp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Arthvion Development Environment${NC}"
echo ""

# Check if venv exists and activate
if [ ! -d "$VENV" ]; then
    echo -e "${YELLOW}Creating Python virtual environment...${NC}"
    python3 -m venv "$VENV"
fi

source "$VENV/bin/activate"

# Install deps if needed
if [ ! -f "$VENV/.install-complete" ]; then
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    pip install -e "$REPO_ROOT" -r "$REPO_ROOT/backend/requirements.txt" -q
    touch "$VENV/.install-complete"
fi

# Check for .env
if [ ! -f "$REPO_ROOT/infra/.env" ]; then
    echo -e "${RED}Error: infra/.env not found${NC}"
    echo "Copy infra/.env.example to infra/.env and fill in required vars:"
    echo "  - ANTHROPIC_API_KEY (required)"
    echo "  - TAVILY_API_KEY (required)"
    echo "  - FMP_API_KEY (optional, for earnings/comps/screener)"
    echo "  - STRIPE_SECRET_KEY (optional, for billing)"
    echo "  - STRIPE_WEBHOOK_SECRET (optional, get from 'stripe listen')"
    exit 1
fi

# Cleanup logs
rm -f "$LOG_DIR"/arthvion-*.log

# Start Docker services (postgres + redis)
echo -e "${GREEN}Starting PostgreSQL and Redis...${NC}"
(cd "$REPO_ROOT/infra" && docker compose up postgres redis -d) 2>&1 | grep -v "is already running" || true
echo -e "${GREEN}✓ Database services running${NC}"

# Give postgres time to start
sleep 2

# Start backend
echo -e "${GREEN}Starting FastAPI backend on :8000...${NC}"
"$VENV/bin/uvicorn" backend.main:app --reload --host 127.0.0.1 --port 8000 \
    > "$LOG_DIR/arthvion-backend.log" 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend PID: $BACKEND_PID${NC}"

# Give backend time to start
sleep 2

# Start Celery worker
echo -e "${GREEN}Starting Celery worker...${NC}"
"$VENV/bin/celery" -A backend.core.celery_app worker --loglevel=info \
    > "$LOG_DIR/arthvion-worker.log" 2>&1 &
WORKER_PID=$!
echo -e "${GREEN}✓ Worker PID: $WORKER_PID${NC}"

# Start Celery beat scheduler
echo -e "${GREEN}Starting Celery beat scheduler...${NC}"
"$VENV/bin/celery" -A backend.core.celery_app beat --loglevel=info \
    > "$LOG_DIR/arthvion-beat.log" 2>&1 &
BEAT_PID=$!
echo -e "${GREEN}✓ Beat scheduler PID: $BEAT_PID${NC}"

# Start frontend
echo -e "${GREEN}Starting React frontend on :3000...${NC}"
(cd "$REPO_ROOT/frontend" && npm run dev \
    > "$LOG_DIR/arthvion-frontend.log" 2>&1) &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend PID: $FRONTEND_PID${NC}"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ All services running!${NC}"
echo ""
echo "  Backend:       http://localhost:8000"
echo "  Frontend:      http://localhost:3000"
echo "  API Docs:      http://localhost:8000/docs"
echo ""
echo "  Logs:"
echo "    Backend:  tail -f $LOG_DIR/arthvion-backend.log"
echo "    Worker:   tail -f $LOG_DIR/arthvion-worker.log"
echo "    Beat:     tail -f $LOG_DIR/arthvion-beat.log"
echo "    Frontend: tail -f $LOG_DIR/arthvion-frontend.log"
echo ""
echo -e "${YELLOW}Stripe webhook testing (local dev):${NC}"
echo "  1. Install Stripe CLI: https://stripe.com/docs/stripe-cli"
echo "  2. Run: stripe listen --forward-to localhost:8000/api/v1/billing/webhook"
echo "  3. Copy the signing secret to STRIPE_WEBHOOK_SECRET in infra/.env"
echo ""
echo -e "${YELLOW}Ctrl+C to stop all services${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Trap Ctrl+C to cleanup
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"

    kill $BACKEND_PID 2>/dev/null || true
    kill $WORKER_PID 2>/dev/null || true
    kill $BEAT_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true

    # Give processes time to shut down gracefully
    sleep 2

    # Force kill any stragglers
    kill -9 $BACKEND_PID 2>/dev/null || true
    kill -9 $WORKER_PID 2>/dev/null || true
    kill -9 $BEAT_PID 2>/dev/null || true
    kill -9 $FRONTEND_PID 2>/dev/null || true

    # Stop Docker services
    (cd "$REPO_ROOT/infra" && docker compose down) 2>/dev/null || true

    echo -e "${GREEN}✓ All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep script running
wait
