rm -rf node_modules package-lock.json
npm install
npm run build
[ $? -eq 0 ] || exit
mkdir -p ~/Documents/Alex\'s\ Messy\ Mind/.obsidian/plugins/dynamic-todo-list
cp manifest.json ~/Documents/Alex\'s\ Messy\ Mind/.obsidian/plugins/dynamic-todo-list/
cp main.js ~/Documents/Alex\'s\ Messy\ Mind/.obsidian/plugins/dynamic-todo-list/
cp styles.css ~/Documents/Alex\'s\ Messy\ Mind/.obsidian/plugins/dynamic-todo-list/
