// import re

// from conans.errors import ConanException

function get_bool_from_text(value) {
  value = value.toLowerCase();
  if (["1", "yes", "y", "true"].includes(value)) {
    return true;
  }
  if (["0", "no", "n", "false"].includes(value)) {
    return false
  }
  throw `Unrecognized boolean value '${value}'`
}


class ConfigParser {
  // util class to load a file with sections as [section1]
  //  checking the values of those sections, and returns each section
  // as parser.section
  constructor(text, allowed_fields = null, parse_lines = false, raise_unexpected_field = true) {
    this._sections = {};
    this._allowed_fields = allowed_fields || [];
    let pattern = /^\[([a-z_]{2,50})]/;
    let current_lines = null;
    for (var line of text.split('\n')) {
      line = line.trim()
      if (line[0] == '#') {
        continue;
      }
      let field = null;
      if (line[0] == '[') {
        const m = line.match(pattern);
        if (m) {
          field = m[1];
        } else {
          throw `ConfigParser: Bad syntax '${line}'`;
        }
      }
      if (field) {
        if (this._allowed_fields && !this._allowed_fields.includes(field) &&
          raise_unexpected_field) {
          throw `"ConfigParser: Unrecognized field '${field}'`;
        }
        else {
          current_lines = []
          this._sections[field] = current_lines
        }
      }
      else {
        if (!current_lines) {
          throw `ConfigParser: Unexpected line '${line}'`;
        }
        if (parse_lines) {
          line = line.split(' #', 1)[0]
          line = line.split('    #', 1)[0]
          line = line.trim()
        }
        if (line.length > 0) {
          current_lines.push(line);
        }
      }
    }
  }

  get(name) {
    if (name in this._sections) {
      return this._sections[name];
    }
    if (this._allowed_fields && this._allowed_fields.includes(name)) {
      return '';
    }

    throw `ConfigParser: Unrecognized field '${name}'`;
  }

  add(section, item) {
    if (!section in this._sections) {
      throw `ConfigParser: Unrecognized field '${item}'`;
    }

    this._sections[section].push(item);
  }

  stringify() {
    return Object.entries(this._sections).map(([name, values]) => {
      return [`[${name}]`, ...values].join('\n');
    }).join('\n\n');
  }
}

exports.ConfigParser = ConfigParser;
