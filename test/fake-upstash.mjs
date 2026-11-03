// Redis REST falso para testes: mesma forma de resposta da Upstash e scripts Lua
// executados de verdade (fengari), para o cliente real percorrer o caminho real.
import http from "node:http";
import { fileURLToPath } from "node:url";
import fengari from "fengari";

const { lua, lauxlib, lualib, to_luastring: toLua, to_jsstring: toJs } = fengari;

function command(hash, [name, ...args]) {
  const [, ...rest] = args.map(String);
  switch (String(name).toLowerCase()) {
    case "hgetall":
      return [...hash.entries()].flat();
    case "hget":
      return hash.get(rest[0]) ?? null;
    case "hexists":
      return hash.has(rest[0]) ? 1 : 0;
    case "hset":
      for (let i = 0; i < rest.length; i += 2) hash.set(rest[i], rest[i + 1]);
      return rest.length / 2;
    case "hsetnx":
      if (hash.has(rest[0])) return 0;
      hash.set(rest[0], rest[1]);
      return 1;
    case "hdel":
      return rest.filter((field) => hash.delete(field)).length;
    case "hincrby": {
      const value = Number(hash.get(rest[0]) ?? 0) + Number(rest[1]);
      hash.set(rest[0], String(value));
      return value;
    }
    case "expire":
      return 1;
    default:
      throw new Error(`Comando não suportado: ${name}`);
  }
}

function pushValue(L, value) {
  if (value === null) lua.lua_pushboolean(L, 0); // nil do Redis vira false no Lua
  else if (typeof value === "number") lua.lua_pushinteger(L, value);
  else if (Array.isArray(value)) {
    lua.lua_createtable(L, value.length, 0);
    value.forEach((item, i) => {
      lua.lua_pushstring(L, toLua(item));
      lua.lua_rawseti(L, -2, i + 1);
    });
  } else lua.lua_pushstring(L, toLua(value));
}

function setStringArray(L, name, values) {
  lua.lua_createtable(L, values.length, 0);
  values.forEach((value, i) => {
    lua.lua_pushstring(L, toLua(String(value)));
    lua.lua_rawseti(L, -2, i + 1);
  });
  lua.lua_setglobal(L, toLua(name));
}

function evalScript(hash, script, keys, argv) {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  lua.lua_createtable(L, 0, 1);
  lua.lua_pushcfunction(L, (state) => {
    const args = [];
    for (let i = 1; i <= lua.lua_gettop(state); i++) args.push(toJs(lua.lua_tolstring(state, i)));
    pushValue(state, command(hash, args));
    return 1;
  });
  lua.lua_setfield(L, -2, toLua("call"));
  lua.lua_setglobal(L, toLua("redis"));
  setStringArray(L, "KEYS", keys);
  setStringArray(L, "ARGV", argv);

  if (lauxlib.luaL_loadstring(L, toLua(script)) !== lua.LUA_OK || lua.lua_pcall(L, 0, 1, 0) !== lua.LUA_OK) {
    throw new Error(toJs(lua.lua_tolstring(L, -1)));
  }
  return lua.lua_isinteger(L, -1) ? lua.lua_tointeger(L, -1) : null;
}

export function startFakeUpstash(port = 0) {
  const rooms = new Map();
  const state = { down: false };

  function run(parsed) {
    const [name, ...args] = parsed;
    if (String(name).toLowerCase() === "eval") {
      const [script, numKeys, ...rest] = args;
      const keys = rest.slice(0, Number(numKeys));
      if (!rooms.has(keys[0])) rooms.set(keys[0], new Map());
      return evalScript(rooms.get(keys[0]), String(script), keys, rest.slice(Number(numKeys)));
    }
    if (!rooms.has(args[0])) rooms.set(args[0], new Map());
    return command(rooms.get(args[0]), parsed);
  }

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      if (req.url === "/__down" || req.url === "/__up") {
        state.down = req.url === "/__down";
        return res.end("ok");
      }
      res.setHeader("content-type", "application/json");
      if (state.down) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: "ERR max requests limit exceeded" }));
      }
      const base64 = req.headers["upstash-encoding"] === "base64";
      const encode = (value) => {
        if (Array.isArray(value)) return value.map(encode);
        return base64 && typeof value === "string" ? Buffer.from(value).toString("base64") : value;
      };
      try {
        const parsed = JSON.parse(body);
        // O cliente agrupa comandos automaticamente nessas rotas.
        const batch = req.url.startsWith("/pipeline") || req.url.startsWith("/multi-exec");
        const payload = batch
          ? parsed.map((cmd) => ({ result: encode(run(cmd)) }))
          : { result: encode(run(parsed)) };
        res.end(JSON.stringify(payload));
      } catch (error) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: String(error) }));
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await startFakeUpstash(Number(process.argv[2] ?? 8079));
}
