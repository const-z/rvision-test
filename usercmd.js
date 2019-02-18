const path = require("path");

const moment = require("moment");

/**
 * Обработчик пользовательских команд
 * @class UserCommand
 */
class UserCommand {
  /**
   * Конструктор экземпляра класса UserCommand
   *
   * @param {ssh2.Client} sshClient клиент ssh сессии
   * @param {Stream} shell поток ввода-вывода для взаимодействия с удаленным терминалом
   * @param {String} workDir рабочая директория по-умолчанию
   */
  constructor({ sshClient, shell, workDir = "./" }) {
    this.commands = {
      get: "`Downloading from ${from} to ${to}`",
      put: "`Uploading from ${from} to ${to}`",
    };
    this.sshClient = sshClient;
    this.shell = shell;
    this.command = null;
    this.standardPrompt = new RegExp("[>$%#]\\s?");
    this.currentDir = "~";
    this.workDir = workDir;
  }

  /**
   * Определить, являются ли введенные данные в терминале клиентской командой.
   * Если да, то запустить соотвествующую команду
   *
   * @param {String} line строка, которая может являться пользовательской командой
   */
  execute(line) {
    this.command = null;
    const matches = line.match(this.standardPrompt);

    if (!matches) {
      return;
    }

    this.currentDir = line.slice(line.indexOf(":") + 1, matches.index);
    this.currentDir = this.currentDir === "~" ? this.workDir : this.currentDir;
    const commandLine = line.slice(matches.index + matches[0].length);
    const cmdKey = Object.keys(this.commands).find((key) => commandLine.trim().startsWith(key));

    if (cmdKey) {
      const [name, from, to] = commandLine.trim().split(/\s+/g);
      this.command = {
        key: cmdKey,
        from,
        to,
        prompt: this.commands[cmdKey],
      };

      this.shell.stdout.unpipe();

      this._execute(() => {
        setTimeout(() => {
          this._flush();
          this.shell.stdout.pipe(process.stdout);
          this.shell.stdout.write("\x15");
          this.shell.stdout.write("\x0D");
        }, 1000);
        this.command = null;
      });
    }
  }

  /**
   * Заменить литералы в строке s на соответствующие занчения параметров (params)
   * @param {String} s литеральная строка
   * @param {Object} params параметры для заполнения
   * @returns {String}
   */
  _compileTemplate(s, params) {
    return Function(...Object.keys(params), "return " + s)(...Object.values(params));
  }

  /**
   * Очистить терминальный буфер
   */
  _flush() {
    while (this.shell.stdin.read() !== null) {}
    while (this.shell.stdout.read() !== null) {}
  }

  /**
   * Нормализовать путь, чтобы он был виден для удаленного sftp подключения
   *
   * @param {String} from
   */
  _normalize(from) {
    const pathFrom = path.normalize([this.currentDir.trim(), from].join("/")).replace(/\\/g, "/");

    return pathFrom;
  }

  /**
   * Вывести ошибку
   *
   * @param {Error} err
   * @returns {Boolean} если ошибка, то true
   */
  _error(err) {
    if (!err) {
      return false;
    }

    process.stderr.write(`[${moment().format("HH:mm:ss")}] ${err}\n`);

    return true;
  }

  /**
   * Выполнить команду get - скачать файл с удаленного сервера
   *
   * @param {String} from путь к файлу на удаленном сервере
   * @param {String} to путь к файлу на локальной машине
   * @param {Function} callback
   */
  _commandGet(from, to, callback) {
    if (!to) {
      const p = path.parse(from);
      to = `${this.workDir}/${p.name}${p.ext}`;
    }

    process.stdout.write(
      `\n[${moment().format("HH:mm:ss")}] ${this._compileTemplate(this.command.prompt, { from, to })}\n`
    );

    this.sshClient.sftp((err, sftp) => {
      if (this._error(err)) {
        sftp.end();

        return callback();
      }
      const pathFrom = this._normalize(from);
      sftp.fastGet(pathFrom, to, {}, (err) => {
        if (this._error(err)) {
          sftp.end();

          return callback();
        }
        process.stdout.write(`[${moment().format("HH:mm:ss")}] ...completed successfully\n`);
        sftp.end();

        callback();
      });
    });
  }

  /**
   * Выполнить команду put - отправить файл на удаленный сервер
   *
   * @param {String} from путь к файлу на локальной машине
   * @param {String} to путь к файлу на удаленном сервере
   * @param {Function} callback
   */
  _commandPut(from, to, callback) {
    if (!to) {
      const p = path.parse(from);
      to = `./${p.name}${p.ext}`;
    }

    process.stdout.write(
      `\n[${moment().format("HH:mm:ss")}] ${this._compileTemplate(this.command.prompt, { from, to })}\n`
    );

    this.sshClient.sftp((err, sftp) => {
      if (this._error(err)) {
        sftp.end();

        return callback();
      }
      sftp.fastPut(from, to, {}, (err) => {
        if (this._error(err)) {
          sftp.end();

          return callback();
        }
        process.stdout.write(`[${moment().format("HH:mm:ss")}] ...completed successfully\n`);
        sftp.end();

        callback();
      });
    });
  }

  /**
   * Выбрать коменду и выполнить ее
   * @param {Function} callback
   */
  _execute(callback) {
    if (!this.command) {
      return callback();
    }

    const { key, ...params } = this.command;

    switch (key) {
      case "get":
        this._commandGet(params.from, params.to, callback);
        break;
      case "put":
        this._commandPut(params.from, params.to, callback);
        break;
    }
  }
}

module.exports = UserCommand;
