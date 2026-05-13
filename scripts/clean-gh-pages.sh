#!/bin/bash

set -e  # Exit on error

echo "Starting gh-pages branch cleanup..."

REMOVE_PATHS_FILE="/tmp/remove-paths.txt"
> "$REMOVE_PATHS_FILE"

all_dirs=$(git ls-tree -d origin/gh-pages:pr-preview --name-only 2>/dev/null || true)

if [ -z "$all_dirs" ]; then
    echo "No directories found in pr-preview or pr-preview does not exist"
    rm "$REMOVE_PATHS_FILE"
    exit 0
fi

echo "Found PR preview directories: $(echo "$all_dirs" | wc -l | tr -d ' ')"

while IFS= read -r dir; do
    if [ -z "$dir" ]; then continue; fi

    pr_num="${dir#pr-}"

    # Check if PR is still open via GitHub CLI
    state=$(gh pr view "$pr_num" --json state -q '.state' 2>/dev/null || echo "UNKNOWN")

    if [ "$state" = "OPEN" ]; then
        echo "PR #$pr_num is OPEN — keeping pr-preview/$dir"
    else
        echo "PR #$pr_num is $state — marking pr-preview/$dir for removal"
        echo "pr-preview/$dir" >> "$REMOVE_PATHS_FILE"
    fi
done <<< "$all_dirs"

if [ ! -s "$REMOVE_PATHS_FILE" ]; then
    echo "All preview directories belong to open PRs. Nothing to clean."
    rm "$REMOVE_PATHS_FILE"
    exit 0
fi

count=$(wc -l < "$REMOVE_PATHS_FILE" | tr -d ' ')
echo "Removing $count preview directories..."

uvx git-filter-repo@2.47.0 --force --paths-from-file "$REMOVE_PATHS_FILE" --invert-paths --refs refs/remotes/origin/gh-pages
