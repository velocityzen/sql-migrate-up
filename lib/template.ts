import { Parameters } from "./types";

export function applyData(
  migrationFile: string,
  templateSql: string,
  data: Parameters,
): string {
  const sql = Array.from(Object.entries(data)).reduce(
    (sql, [key, value]) => (value ? sql.replaceAll(`{{${key}}}`, value) : sql),
    templateSql,
  );

  const extraParameters = Array.from(sql.matchAll(/{{([-a-zA-Z0-9_]+)}}/gi));
  if (extraParameters.length > 0) {
    const extraNames = extraParameters.map((tuple) => tuple[1]);
    throw new Error(
      `Found extra parameters (${extraNames.join(",")}) in "${migrationFile}"`,
    );
  }

  return sql;
}
