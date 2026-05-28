export PATH="$HOME/.bun/bin:/opt/homebrew/bin:$PATH"

if command -v pnpm >/dev/null 2>&1; then
	return 0
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [ -s "$NVM_DIR/nvm.sh" ]; then
	. "$NVM_DIR/nvm.sh"
fi
