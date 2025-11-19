# TOON Format Reference

Complete reference for Token-Oriented Object Notation (TOON) v2.0

## Overview

TOON is a compact, human-readable encoding of the JSON data model optimized for LLM prompts. It achieves ~40% fewer tokens than JSON while maintaining lossless round-trip conversion.

**Key characteristics:**

- Line-oriented, indentation-based (like YAML)
- Explicit array lengths with `[N]` declarations
- CSV-style tabular format for uniform object arrays
- Minimal quoting requirements
- Deterministic encoding

---

## Basic Syntax

### Indentation

- Use 2 spaces per level (no tabs)
- Single space after `:` in key-value pairs
- No trailing spaces or trailing newline at document end

### Keys

**Unquoted keys** (preferred):

```
validKey: value
another_key: value
key123: value
```

Pattern: `^[A-Za-z_][A-Za-z0-9_.]*$`

**Quoted keys** (when containing special characters):

```
"key with spaces": value
"key:with:colons": value
```

---

## Data Types

### Primitives

```toon
string: hello world
number: 42
float: 3.14
negative: -100
boolean: true
nullValue: null
```

### Strings - When to Quote

**MUST quote when string contains:**

- Empty string: `""`
- Leading/trailing whitespace: `" hello "`
- Literals `true`, `false`, `null`
- Numbers or numeric patterns: `"123"`, `"3.14"`
- Colons: `"key: value"`
- Quotes or backslashes: `"say \"hello\""`
- Brackets or braces: `"[array]"`, `"{object}"`
- Control characters (newline, tab, carriage return)
- Active delimiter (comma by default)
- Hyphen at start: `"-item"`

**Can be unquoted:**

```toon
simple: hello
withNumbers: hello123
path: /usr/local/bin
```

### Escape Sequences

Only these five escapes are valid:

- `\\` → backslash
- `\"` → double quote
- `\n` → newline
- `\r` → carriage return
- `\t` → tab

```toon
escaped: "line1\nline2"
quoted: "she said \"hello\""
```

### Numbers

Encoders normalize numbers:

- No exponent notation: `1000000` not `1e6`
- No leading zeros: `5` not `05`
- No trailing zeros: `1.5` not `1.5000`
- `-0` becomes `0`
- `NaN`, `Infinity` become `null`

---

## Objects

### Simple Object

```toon
user:
  id: 123
  name: Ada
  email: ada@example.com
```

### Nested Objects

```toon
config:
  database:
    host: localhost
    port: 5432
  cache:
    enabled: true
    ttl: 3600
```

### Empty Object

Empty objects produce no lines at root level.

---

## Arrays

### Primitive Arrays (Inline)

Syntax: `key[N]: v1,v2,v3`

```toon
tags[3]: admin,ops,dev
numbers[4]: 1,2,3,4
mixed[3]: hello,42,true
```

- `[N]` declares the array length
- Values separated by comma (default delimiter)

### Arrays with Different Delimiters

**Tab delimiter** (for values containing commas):

```toon
data[2	]: value, with comma	another value
```

**Pipe delimiter**:

```toon
items[3|]: first|second|third
```

### Tabular Arrays (Uniform Objects)

When all array elements are objects with identical keys and primitive values, use tabular format.

Syntax: `key[N]{field1,field2,field3}:`

```toon
users[3]{id,name,email}:
  1,Ada,ada@example.com
  2,Bob,bob@example.com
  3,Carol,carol@example.com
```

Equivalent JSON:

```json
{
  "users": [
    { "id": 1, "name": "Ada", "email": "ada@example.com" },
    { "id": 2, "name": "Bob", "email": "bob@example.com" },
    { "id": 3, "name": "Carol", "email": "carol@example.com" }
  ]
}
```

### Mixed Arrays (Objects as List Items)

For non-uniform arrays or objects with nested structures:

```toon
items[2]:
  - id: 1
    name: First
    tags[2]: a,b
  - id: 2
    name: Second
    tags[3]: x,y,z
```

### Arrays of Arrays

```toon
matrix[3]:
  - [3]: 1,2,3
  - [3]: 4,5,6
  - [3]: 7,8,9
```

### Empty Array

```toon
emptyList[0]:
```

---

## Complete Examples

### Example 1: User Profile

```toon
profile:
  id: 12345
  username: jdoe
  settings:
    theme: dark
    notifications: true
    language: en
  roles[3]: admin,editor,viewer
  loginHistory[3]{date,ip,success}:
    2025-01-15,192.168.1.1,true
    2025-01-14,192.168.1.2,true
    2025-01-13,10.0.0.1,false
```

### Example 2: Product Catalog

```toon
catalog:
  name: Electronics Store
  lastUpdated: 2025-11-18
  products[4]{sku,name,price,inStock}:
    ELEC001,Laptop,999.99,true
    ELEC002,Mouse,29.99,true
    ELEC003,Keyboard,79.99,false
    ELEC004,Monitor,299.99,true
  categories[3]: computers,accessories,displays
```

### Example 3: API Configuration

```toon
api:
  version: 2.0
  baseUrl: https://api.example.com
  endpoints[3]{method,path,auth}:
    GET,/users,true
    POST,/users,true
    GET,/public,false
  rateLimit:
    requests: 1000
    window: 3600
  features[4]: caching,compression,logging,metrics
```

### Example 4: With Quoted Values

```toon
messages[3]{type,content,metadata}:
  info,"Hello, world!","{\"priority\": 1}"
  warning,"Check your input: value",""
  error,"Failed to process \"data\"",null
```

---

## Key Folding (Optional)

Dotted keys can represent nested structures:

```toon
user.name: Ada
user.email: ada@example.com
```

Expands to:

```json
{
  "user": {
    "name": "Ada",
    "email": "ada@example.com"
  }
}
```

---

## Quick Reference

### Header Formats

| Format               | Description     | Example               |
| -------------------- | --------------- | --------------------- |
| `key[N]:`            | Primitive array | `tags[3]: a,b,c`      |
| `key[N]{f1,f2}:`     | Tabular array   | `items[2]{id,name}:`  |
| `key[N]:` + `- item` | Mixed array     | Objects as list items |

### Quoting Checklist

Quote the string if it:

- [ ] Is empty
- [ ] Has leading/trailing whitespace
- [ ] Equals `true`, `false`, or `null`
- [ ] Looks like a number
- [ ] Contains `:`, `"`, `\`, `[`, `]`, `{`, `}`
- [ ] Contains the active delimiter (usually `,`)
- [ ] Starts with `-`
- [ ] Contains newlines, tabs, or carriage returns

### Common Patterns

**Config file:**

```toon
config:
  key: value
  nested:
    inner: value
```

**List of items:**

```toon
items[N]{field1,field2,field3}:
  val1,val2,val3
  val1,val2,val3
```

**Simple list:**

```toon
list[N]: item1,item2,item3
```

---

## Validation Rules (Strict Mode)

- Array length `[N]` must match actual item count
- Tabular row value count must match field count
- Keys must be followed by `:`
- Only valid escape sequences allowed
- Indentation must be exact multiples of indent size
- No tabs in indentation
- No blank lines inside arrays/tabular rows

---

## When to Use TOON

**Best for:**

- Uniform arrays of objects (tabular data)
- Configuration with mixed simple and complex values
- LLM context where token efficiency matters

**Avoid for:**

- Deeply nested structures (3+ levels)
- Semi-uniform data (40-60% tabular)
- Pure flat tables (use CSV instead)

---

## Conversion Tips

### JSON to TOON

1. Identify uniform object arrays → convert to tabular format
2. Simple arrays → inline with `[N]:`
3. Objects → indented key-value pairs
4. Apply quoting rules to strings

### TOON to JSON

1. Parse headers to determine structure
2. Split values by active delimiter
3. Type unquoted values (true/false/null/number/string)
4. Unescape quoted strings

---

## File Extension

`.toon`

## Media Type

`text/toon` (UTF-8 encoding, LF line endings)

---

## Resources

- Specification: https://github.com/toon-format/spec/blob/main/SPEC.md
- Repository: https://github.com/toon-format/toon
- Test fixtures: https://github.com/toon-format/spec/tree/main/tests
