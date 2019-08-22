let fs = require('fs');
let path = require('path');
var parseScript = require('shift-parser').parseScript;
const { parse } = require('json2csv');

class MultiJsParser{
    constructor (config) {
        this.config = config;
        this.jsList = [];
    }

    getJsList(startPath, filter){
        return new Promise( (resolve, reject) => {
            console.log('Starting from dir '+startPath+'/');

            if (!fs.existsSync(startPath)){
                console.log("no dir ", startPath);
                return;
            }
            
            var files = fs.readdirSync(startPath);
            
            var excludeFileList = this.config.excludedFileList;
            
            for(var i=0; i < files.length; i++){
                var filename = path.join( startPath, files[i] );
                var stat = fs.lstatSync(filename);
                if (stat.isDirectory()){
                    this.getJsList(filename, filter); //recurse
                }
                else if (filename.split('.').pop() === filter) {
                    var isCorrectFile = true;
                    for(var m =0; m < excludeFileList.length; m++ ){
                        if (filename.indexOf(excludeFileList[m]) > -1){
                            isCorrectFile = false;
                            break;
                        }                        
                    }
                    if(isCorrectFile) {
                        this.jsList.push(filename);
                    }
                };
            };
            console.log(this.jsList);
            resolve(this.jsList);
        });
    };

    getMetaModel(jsList) {
        return new Promise( (resolve, reject) => {
            var metaModel = [];
            try {
                for (var i = 0; i < jsList.length; i++){
                
                    var code = fs.readFileSync(jsList[i], 'utf-8');
                    
                    var ast = parseScript(code);
        
                    var classModel = this.getClassProperties(ast, jsList[i]);
                    
                    metaModel.push(classModel);
                }
                resolve(metaModel);
            }
            catch(error) {
                console.error(error);
            }
        })
    };

    getClassProperties(ast, fileName) { 
        ast = (ast.type = "Script") ? ast.statements[0] : null;
        var output = {};
        output.fileName = fileName;
        if(ast.type = "FunctionDeclaration")  {
            output.class = ast.name.name;
            ast = (ast.body.type = "FunctionBody") ? ast.body.statements : null;
            output.vars = [];
            output.args = [];
            output.methods = [];
            for(var i = 0; i < ast.length; i++) {
                
                var indData = ast[i];
                var type = indData.type;
                switch (type) {
                    case "VariableDeclarationStatement":
                        var variable = indData.declaration.declarators[0].binding.name;
                        output.vars.push(variable);
                        break;
                    case "ExpressionStatement":
                        if(indData.expression.type == "AssignmentExpression" && indData.expression.expression.type == "FunctionExpression"){
                            var method = {name: indData.expression.binding.property , params: this.getParams(indData.expression.expression.params.items)};
                            output.methods.push(method);
                        } else{
                            var arg = indData.expression.binding.property;
                            output.args.push(arg);
                        }
                        break;
                }
            };
            return output;
        };
        
    };
    
    convertObj(metaModel){
        var csvObj = [];

        for (var i = 0; i < metaModel.length; i++){
            let fileProperties = metaModel[i];
            
            let fileName = metaModel[i].fileName;
            let className = metaModel[i].class;
            let attributes = metaModel[i].args;
            let methods = metaModel[i].methods;
            let variables = metaModel[i].vars;

            if (attributes != null && attributes.length) {
                for(var j = 0; attributes.length > j; j++ ){
                    var row = {};
                    row.fileName = fileName;
                    row.className = className;
                    row.property = "this." + attributes[j];
                    csvObj.push(row);
                }
            }

            if (variables != null && variables.length) {
                for(var l = 0; variables.length > l; l++ ){
                    var row = {};
                    row.fileName = fileName;
                    row.className = className;
                    row.property = "var " + variables[l];
                    csvObj.push(row);
                }
            }

            if (methods != null && methods.length) {
                for(var k = 0; methods.length > k; k++ ){
                    var methodProperty = "this." + methods[k].name + "(" + methods[k].params.toString() + ")";
                    var row = {};
                    row.fileName = fileName;
                    row.className = className;
                    row.property = methodProperty;
                    csvObj.push(row);
                }
            }
        }
        return csvObj;
    };

    load(){
        return new Promise( (resolve, reject) => {
            this.getJsList(this.config.baseDir, 'js')
            .then((jsList) => {
                let promise = this.getMetaModel(jsList);
                return promise;
            })
            .then((metaModel) => {
                let csvObj = this.convertObj(metaModel);
                console.log(csvObj);
                return csvObj;
            })
            .then((csvObj) => {
                const fields = ['fileName', 'className', 'property'];
                const opts = { fields };
                const csv = parse(csvObj, opts);
                console.log(csv);
                return csv;
            })
            .then((csv) => {
                fs.writeFile("./output.csv", csv, 'binary', function(err){
                    if (err) {
                        reject(err);
                    } else { 
                        resolve(true);
                    }
                    console.log('File saved.')
                })
            })
            .catch((err) => {
                console.log(err);
            })
        })
    };

    getParams(paramList){
        var params = [];
        if (paramList != null && paramList.length) {
            for(var j = 0; paramList.length > j; j++ ){
                params.push(paramList[j].name);
            }
        }
        return params;
    };

    static newInstance(config) {
        let obj = new MultiJsParser(config);
        return obj;
    }
}

module.exports = MultiJsParser;