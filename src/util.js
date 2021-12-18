const fs = require('fs');
const os = require('os');
const path = require('path');
const vscode = require('vscode');
let editor = null;

/**
 * @param {*} context
 * @param {*} templatePath
 */
function getWebViewContent(context, templatePath) {
    const resourcePath = util.getExtensionFileAbsolutePath(context, templatePath);
    const dirPath = path.dirname(resourcePath);
    let html = fs.readFileSync(resourcePath, 'utf-8');
    html = html.replace(/(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (m, $1, $2) => {
        return $1 + vscode.Uri.file(path.resolve(dirPath, $2)).with({
            scheme: 'vscode-resource'
        }).toString() + '"';
    });
    return html;
}

const util = {
    getWebViewContent: getWebViewContent,

    setEditor: function(){
        editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document) {
            this.showError('当前激活的编辑器不是文件或者没有文件被打开！');
            return '';
        }

        vscode.window.onDidChangeActiveTextEditor((ed) => {
            if(ed && ed.document){
                editor = ed;
            }
        });
    },
    /**
     * 弹出错误信息
     */
    showError: function (info) {
        vscode.window.showErrorMessage(info);
    },
    /**
     * 弹出提示信息
     */
    showInfo: function (info) {
        vscode.window.showInformationMessage(info);
    },
    /**
     * 获取某个扩展文件绝对路径
     * @param context 上下文
     * @param relativePath 扩展中某个文件相对于根目录的路径，如 images/test.jpg
     */
    getExtensionFileAbsolutePath: function (context, relativePath) {
        return path.join(context.extensionPath, relativePath);
    },
    /**
     * 从某个文件里面查找字符串，返回匹配的行与列，未找到返回第一行第一列
     * @param rules 匹配规则
     *
     */
    findStr: function (rules) {
        const content = editor.document.getText();
        let pos = [];
        let matches;
        for (let index = 0; index < rules.length; index++) {
            const rows = content.split(os.EOL); // 分行查找只为了拿到行
            let rule = new RegExp(rules[index].find, 'g'); // 正则匹配
            for (let i = 0; i < rows.length; i++) {
                while ((matches = rule.exec(rows[i]))) {
                    pos.push({
                        rule: rules[index].find,
                        to: rules[index].to,
                        row: i,
                        col: rule.lastIndex - matches[0].length
                    });
                }
            }
        }
        
        return pos || [{
            row: 0,
            col: 0,
            to: '',
            rule: ''
        }];
    },
    /**
     * 选中匹配的字符串
     */
    selectStr: function (rules) {
        const positions = this.findStr(rules);
        let selections = [];

        for (let i = 0; i < positions.length; i++) {
            selections.push(
                new vscode.Selection(
                    new vscode.Position(positions[i].row, positions[i].col),
                    new vscode.Position(positions[i].row, positions[i].col + positions[i].rule.length)
                )
            )
            editor.selections = selections;
        }
        return positions.length;
    },
    /**
     * 修改当前激活编辑器内容
     */
    replaceEditorContent: function (rules) {
        const positions = this.findStr(rules);
        let content = editor.document.getText();
        for (let index = 0; index < rules.length; index++) {
            let rule = new RegExp(rules[index].find, 'gm'); // 正则匹配
            content = content.replace(rule, rules[index].to.replace(/\\n/g, '\n').replace(/\\t/g, '\t'));
        }

        let invalidRange = new vscode.Range(0, 0, editor.document.lineCount /*intentionally missing the '-1' */, 0);
        let fullRange = editor.document.validateRange(invalidRange);
        editor.edit(edit => edit.replace(fullRange, content));

        return positions.length;
    },
};

module.exports = util;