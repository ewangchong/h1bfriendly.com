#!/bin/bash
# H1B Finder Skill - ClawHub Publish Script

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_JSON="$SKILL_DIR/skill.json"

if [ ! -f "$SKILL_JSON" ]; then
    echo "Error: skill.json not found in $SKILL_DIR"
    exit 1
fi

NAME=$(jq -r .name "$SKILL_JSON")
SLUG=$(jq -r .slug "$SKILL_JSON")
VERSION=$(jq -r .version "$SKILL_JSON")
DESC=$(jq -r .description "$SKILL_JSON")

echo "--- Packaging & Publishing $NAME ($VERSION) ---"

clawhub publish "$SKILL_DIR" \
  --slug "$SLUG" \
  --name "$NAME" \
  --version "$VERSION" \
  --changelog "Initial release of Agent-Ready H1B Finder skill"

echo "Done."
