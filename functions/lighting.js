import { renderArchive } from "./_archive.js";

export const onRequestGet = (context) => renderArchive(context, "lighting");
