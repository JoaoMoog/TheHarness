// One expanded stash; release metadata on collapse, dialog close or root change.
export const STASH_PAGE = 50,
  STASH_FILES_PAGE = 100;
export function createStashState() {
  let root = "",
    oid = "",
    paths = [],
    error = "",
    loading = false,
    token = 0,
    pending = false;
  function clear() {
    oid = "";
    paths = [];
    error = "";
    loading = false;
    token++;
  }
  return {
    setRoot(next) {
      if (root !== next) {
        root = next;
        clear();
      }
    },
    clear,
    prune(items) {
      if (oid && !items.some((s) => s.oid === oid)) clear();
    },
    get view() {
      return { oid, paths, error, loading };
    },
    async toggle(next, read) {
      if (oid === next) {
        clear();
        return;
      }
      if (pending) return; // One actual RPC, including obsolete reads.
      clear();
      oid = next;
      loading = pending = true;
      const ticket = token,
        requestRoot = root;
      try {
        const value = await read({ root: requestRoot, oid: next });
        if (ticket !== token) return;
        if (
          !Array.isArray(value.paths) ||
          value.paths.length > 2000 ||
          value.paths.some((p) => typeof p !== "string")
        )
          throw new Error("Lista de arquivos do stash inválida ou volumosa.");
        paths = value.paths;
      } catch (e) {
        if (ticket === token) error = e.message;
      } finally {
        pending = false;
        if (ticket === token) loading = false;
      }
    },
  };
}
