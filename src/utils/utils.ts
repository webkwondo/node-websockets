import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// url should be import.meta.url
const getDirName = (url: string) => {
  const __filename = fileURLToPath(url);
  const __dirname = dirname(__filename);
  return __dirname;
};

const checkArg = (argStr: string) => {
  const args = process.argv.slice(2);
  const result = args.includes(argStr);
  return result;
};

const checkEnv = (keyStr: string, valueStr: string) => {
  const envObj = process.env;
  const result = keyStr in envObj && envObj[keyStr] === valueStr;
  return result;
};

export { getDirName, join, checkArg, checkEnv };
