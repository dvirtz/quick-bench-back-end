const { ConfigParser } = require('./configparser');

class ConanFileTextLoader {
  /// Parse a conanfile.txt file

  constructor(input_text) {
    // Prefer composition over inheritance, the __getattr__ was breaking things
    this._config_parser = new ConfigParser(input_text, ["requires", "generators", "options",
      "imports", "build_requires"],
      true);
  }

  requirements() {
    // returns a list of requires
    // EX:  "OpenCV/2.4.10@phil/stable"
    return this._config_parser.get('requires');
  }

  add_requirement(requirement) {
    this._config_parser.add('requires', requirement);
  }

  build_requirements() {
    // returns a list of build_requires
    // EX:  "OpenCV/2.4.10@phil/stable"
    return this._config_parser.get('build_requires');
  }

  add_build_requirement(requirement) {
    this._config_parser.add('build_requires', requirement);
  }

  options() {
    return this._config_parser.get('options');
  }

  add_option(option) {
    this._config_parser.add('options', option);
  }

  _import_parameters() {
    const _parse_args = (param_string) => {
      var root_package = null, ignore_case = true, folder = false, excludes = null, keep_path = true;
      const params = param_string.split(",").map(String.trim);
      for (const param of params) {
        const split = param.split("=");
        var name = split[0], value = split[1];
        if (!name || !value) {
          throw `Wrong imports argument '${param}'.\nNeed a 'arg=value' pair.`
        }
        name = name.trim();
        value = value.trim();
        if (name == "root_package") {
          root_package = value;
        }
        else if (name == "ignore_case") {
          ignore_case = (value.toLowerCase() == "true");
        }
        else if (name == "folder") {
          folder = (value.toLowerCase() == "true");
        }
        else if (name == "excludes") {
          excludes = value.split();
        }
        else if (name == "keep_path") {
          keep_path = (value.toLowerCase() == "true");
        }
        else {
          throw `Invalid imports. Unknown argument ${name}`;
        }
      }
      return [root_package, ignore_case, folder, excludes, keep_path];
    }

    const _parse_import = (line) => {
      const pair = line.split("->", 1);
      const source = pair[0].trim().split(',', 1);
      const dest = pair[1].trim();
      const src = source[0].trim(), pattern = source[1].trim();
      return [pattern, dest, src];
      // except Exception:
      //     raise ConanException("Wrong imports line: %s\n"
      //                          "Use syntax: path, pattern -> local-folder" % line)
    }

    var ret = [];
    const local_install_text = this._config_parser.imports;
    for (var line of local_install_text.splitlines()) {
      // discard blanks, comments, and discard trailing comments
      line = line.trim();
      if (line.startswith("#")) {
        continue;
      }
      line = line.split("#", 1)[0];

      invalid_line_msg = `Invalid imports line: ${line}\nEX: OpenCV/lib, * -> ./lib`;
      if (line.startsWith("/") || line.startsWith("..")) {
        throw `${invalid_line_msg}\nImport's paths can't begin with '/' or '..'"`;
      }
      try {
        const tokens = line.rsplit("@", 1);
        if (tokens.length > 1) {
          line = tokens[0];
          params = tokens[1];
        } else {
          params = "";
        }
        const parsed_args = _parse_args(params);
        const root_package = parsed_args[0], ignore_case = parsed_args[1], folder = parsed_args[2], excludes = parsed_args[3], keep_path = parsed_args[4];
        const parsed_imports = _parse_import(line);
        const pattern = parsed_imports[0], dest = parsed_imports[1], src = parsed_imports[2];
        ret.push([pattern, dest, src, root_package, folder, ignore_case, excludes,
          keep_path]);
      }
      catch {
        throw invalid_line_msg;
      }
    }
    return ret;
  }

  generators() {
    return this._config_parser.get('generators').split('\n');
  }

  add_generator(generator) {
    this._config_parser.add('generators', generator);
  }

  imports_method(conan_file) {
    const parameters = this._import_parameters();

    const imports = () => {
      for (import_params of parameters) {
        conan_file.copy(...import_params);
      }
    }
    return imports;
  }

  stringify() {
    return this._config_parser.stringify();
  }
}

exports.ConanFileTextLoader = ConanFileTextLoader;
