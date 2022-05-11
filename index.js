var pbjs = require('protobufjs/cli/pbjs');
var glob = require('glob');
var path = require('path');
var fs = require('fs');
var mkdir = require('make-dir');
var crypto = require('crypto');

let defaultOptions = {
    input: '',      // 输入文件匹配
    output: '',     // 输出路径， 如果是文件夹，单文件输出则以 basic.proto.js命名，多文件以文件名拼接
    outputType: 1,  // 输入方式，默认多文件形式， 如果设置为 0，则所有合并为单文件
    target: 'static-module',    // 类型 json|json-module|static\static-module
    format: 'es6',  // 输出格式： es6|commonjs|amd|closure
    create: true,   // 是否需要 create方法
    encode: true,   // 是否需要 encode 方法
    decode: true,   // 是否需要 decode 方法
    verify: true,   // 是否需要 verify 方法
    delimited: true,    // 是否需要 delimited 方法
    beautify: true,     // 是否需要美化代码
    comments: true,     // 是否需要代码注释文档
    convert: true   // 是否需要 from/toObject
};
function ProtobufPlugin(options) {
    this.options = options || {};
    this.options = Object.assign({}, defaultOptions, this.options);
    this.command = [];  // 转译 protobuf 指令集
    this.watch = {};
}

ProtobufPlugin.prototype.apply = function (compiler) {
    if (!this.options.input) {
        console.error('[protobuf plugin] input error');
        return;
    }
    var self = this;
    // 生成前置命令
    self.setBasicCommand();
    if ('hooks' in compiler) {
        var name = this.constructor.name;
        compiler.hooks.emit.tapAsync(name, function (compilation, cb) {
            var files = glob.sync(self.options.input) || [];
            var multipleFiles = [];
            files.forEach(function (file) {
                if (self.watchFile(file)) {
                    // Webpack 4 vs 5.
                    if ('add' in compilation.fileDependencies) {
                        compilation.fileDependencies.add(path.resolve(file));
                    } else {
                        compilation.fileDependencies.push(path.resolve(file));
                    }
                    multipleFiles.push(file);
                }
            });
            self.options.outputType == 0 ? self.singleOutput(files, cb) : self.multipleOutput(multipleFiles, cb);
        });
    } else {
        compiler.plugin('emit', function (compilation, cb) {
            var files = glob.sync(self.options.input) || [];
            var multipleFiles = [];
            files.forEach(function (file) {
                if (self.watchFile(file)) {
                    // Webpack 4 vs 5.
                    if ('add' in compilation.fileDependencies) {
                        compilation.fileDependencies.add(path.resolve(file));
                    } else {
                        compilation.fileDependencies.push(path.resolve(file));
                    }
                    multipleFiles.push(file);
                }
            });
            self.options.outputType == 0 ? self.singleOutput(files, cb) : self.multipleOutput(multipleFiles, cb);
        });
    }
};

ProtobufPlugin.prototype.watchFile = function(file) {
    let data = fs.readFileSync(file);
    let md5 = crypto.createHash('md5').update(data).digest('hex');
    if (!this.watch[file] || this.watch[file] !== md5) {
        this.watch[file] = md5;
        return true;
    }
    return false;
};

ProtobufPlugin.prototype.setBasicCommand = function () {
    var command = [];
    var options = this.options;
    command.push('-t');
    command.push(options.target || 'static-module');
    command.push('-w');
    command.push(options.format || 'es6');
    ['create', 'encode', 'decode', 'verify', 'delimited', 'beautify', 'comments', 'convert'].forEach(function (key) {
        if (!options[key]) {
            command.push('--no-' + key);
        }
    });
    this.command = command;
};

// 单文件输出
ProtobufPlugin.prototype.singleOutput = function (files, cb) {
    var command = [].concat(this.command);
    command = command.concat(files);
    // 输出路径
    var outputPath = /.js$/.test(this.options.output) ? this.options.output : path.join(this.options.output, 'basic.proto.js');

    // console.log('[protobuf plugin]command: ', 'pbjs ' + command.join(' '));
    pbjs.main(command, function (err, output) {
        if (err) {
            console.log('[protobuf plugin] error: ', err);
            cb();
        }
        var root = path.relative(process.cwd(), outputPath.substr(0, outputPath.lastIndexOf('/')));
        mkdir.sync(root);
        fs.writeFile(outputPath, output, function (error) {
            if (error) {
                console.log('[protobuf plugin] output error: ', error);
            }
            cb();
        });
    });
};

ProtobufPlugin.prototype.multipleOutput = function (files, cb) {
    if (files.length === 0) {
        cb();
    }
    var promise = [];
    var self = this;
    var root = path.relative(process.cwd(), this.options.output);
    mkdir.sync(root);
    files.forEach(function (file) {
        promise.push(new Promise(function (resolve, reject) {
            let command = [].concat(self.command);
            command.push(file);
            pbjs.main(command, function (err, output) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        output: output,
                        file: file
                    });
                }
            });
        }));
    });
    Promise.all(promise)
    .then(function (res) {
        res.forEach(function (result) {
            var output = result.output;
            var file = result.file;
            var outputPath = path.join(self.options.output, path.parse(file).name + '.js');
            fs.writeFile(outputPath, output, function (error) {
                if (error) {
                    console.log('[protobuf plugin] output error: ', error);
                }
            });
        });
        cb();
    })
    .catch(function (err) {
        console.log('[protobuf plugin] promise reject error: ', err);
        cb();
    });
};

module.exports = ProtobufPlugin;
