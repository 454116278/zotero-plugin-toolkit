import { ColumnOptions, ReactElement } from "./options";
import { ZoteroTool } from "./tool";
import { getZotero, log } from "./utils";

/**
 * Tool for adding customized new columns to the library treeView
 */
export class ItemTreeTool {
  /**
   * Signature to avoid patching more than once.
   */
  private patchSign: string;
  /**
   * A ZoteroTool instance.
   */
  private tool: ZoteroTool;
  private Zotero: _ZoteroConstructable;
  private globalCache: ItemTreeExtraColumnsGlobal;
  private initializationLock: _ZoteroPromiseObject;
  /**
   * Initialize Zotero._ItemTreeExtraColumnsGlobal if it doesn't exist.
   *
   * New columns and hooks are stored there.
   *
   * Then patch `require("zotero/itemTree").getColumns` and `Zotero.Item.getField`
   */
  constructor() {
    this.patchSign = "zotero-plugin-toolkit@0.0.1";
    this.tool = new ZoteroTool();
    this.Zotero = getZotero();
    this.initializationLock = this.Zotero.Promise.defer();

    this.initializeGlobal();
  }

  /**
   * Register a new column. Don't forget to call `unregister` on plugin exit.
   * @param key Column dataKey
   * @param label Column display label
   * @param fieldHook Called when loading cell content
   * @param options See zotero source code:chrome/content/zotero/itemTreeColumns.jsx
   * @param options.renderCellHook Called when rendering cell. This will override
   *
   * @example
   * ```ts
   * const itemTree = new ItemTreeTool();
   * await itemTree.register(
   *   "test",
   *   "new column",
   *   (
   *     field: string,
   *     unformatted: boolean,
   *     includeBaseMapped: boolean,
   *     item: Zotero.Item
   *   ) => {
   *     return field + String(item.id);
   *   },
   *   {
   *     iconPath: "chrome://zotero/skin/cross.png",
   *   }
   * );
   * ```
   */
  public async register(
    key: string,
    label: string,
    fieldHook: (
      field: string,
      unformatted: boolean,
      includeBaseMapped: boolean,
      item: Zotero.Item,
      original: Function
    ) => string,
    options: {
      defaultIn?: Set<"default" | "feeds" | "feed" | string>;
      disabledIn?: Set<"default" | "feeds" | "feed" | string>;
      defaultSort?: 1 | -1;
      flex?: number;
      width?: string;
      fixedWidth?: boolean;
      staticWidth?: boolean;
      minWidth?: number;
      iconPath?: string;
      ignoreInColumnPicker?: boolean;
      submenu?: boolean;
      zoteroPersist?: Set<string>;
      renderCellHook?: (
        index: number,
        data: string,
        column: ColumnOptions,
        original: Function
      ) => HTMLElement;
    }
  ) {
    await this.initializationLock.promise;
    if (
      this.globalCache.columns
        .map((_c: ColumnOptions) => _c.dataKey)
        .includes(key)
    ) {
      this.tool.log(`ItemTreeTool: ${key} is already registered.`);
      return;
    }
    const column: ColumnOptions = {
      dataKey: key,
      label: label,
      iconLabel: options.iconPath
        ? this.createIconLabel({
            iconPath: options.iconPath,
            name: label,
          })
        : undefined,
      zoteroPersist:
        options.zoteroPersist ||
        new Set(["width", "ordinal", "hidden", "sortActive", "sortDirection"]),
      defaultIn: options.defaultIn,
      disabledIn: options.disabledIn,
      defaultSort: options.defaultSort,
      flex: typeof options.flex === "undefined" ? 1 : options.flex,
      width: options.width,
      fixedWidth: options.fixedWidth,
      staticWidth: options.staticWidth,
      minWidth: options.minWidth,
      ignoreInColumnPicker: options.ignoreInColumnPicker,
      submenu: options.submenu,
    };
    if (fieldHook) {
      await this.addFieldHook(key, fieldHook);
    }
    if (options.renderCellHook) {
      await this.addRenderCellHook(key, options.renderCellHook);
    }
    this.globalCache.columns.push(column);
    await this.refresh();
  }

  /**
   * Unregister an extra column. Call it on plugin exit.
   * @param key Column dataKey, should be same as the one used in `register`
   */
  public async unregister(key: string) {
    await this.initializationLock.promise;
    let persisted = this.Zotero.Prefs.get("pane.persist") as string;

    const persistedJSON = JSON.parse(persisted) as { [key: string]: any };
    delete persistedJSON[key];
    this.Zotero.Prefs.set("pane.persist", JSON.stringify(persistedJSON));

    const idx = this.globalCache.columns.map((_c) => _c.dataKey).indexOf(key);
    if (idx >= 0) {
      this.globalCache.columns.splice(idx, 1);
    }
    this.removeFieldHook(key);
    this.removeRenderCellHook(key);
    await this.refresh();
  }

  /**
   * Add a patch hook for `getField`, which is called when custom cell is rendered(and in many other cases).
   *
   * Don't patch a Zotero's built-in field.
   * @remarks
   * Don't call it manually unless you understand what you are doing.
   * @param dataKey Cell `dataKey`, e.g. 'title'
   * @param fieldHook patch hook
   */
  public async addFieldHook(
    dataKey: string,
    fieldHook: (
      field: string,
      unformatted: boolean,
      includeBaseMapped: boolean,
      item: Zotero.Item,
      original: Function
    ) => string
  ) {
    await this.initializationLock.promise;
    if (dataKey in this.globalCache.fieldHooks) {
      log(
        "[WARNING] ItemTreeTool.addFieldHook overwrites an existing hook:",
        dataKey
      );
    }
    this.globalCache.fieldHooks[dataKey] = fieldHook;
  }

  /**
   * Remove a patch hook by `dataKey`.
   */
  public removeFieldHook(dataKey: string) {
    return delete this.globalCache.fieldHooks[dataKey];
  }

  /**
   * Add a patch hook for `_renderCell`, which is called when cell is rendered.
   *
   * This also works for Zotero's built-in cells.
   * @remarks
   * Don't call it manually unless you understand what you are doing.
   * @param dataKey Cell `dataKey`, e.g. 'title'
   * @param renderCellHook patch hook
   */
  public async addRenderCellHook(
    dataKey: string,
    renderCellHook: (
      index: number,
      data: string,
      column: ColumnOptions,
      original: Function
    ) => HTMLElement
  ) {
    await this.initializationLock.promise;
    if (dataKey in this.globalCache.fieldHooks) {
      log(
        "[WARNING] ItemTreeTool.addRenderCellHook overwrites an existing hook:",
        dataKey
      );
    }
    this.globalCache.renderCellHooks[dataKey] = renderCellHook;
  }

  /**
   * Remove a patch hook by `dataKey`.
   */
  public async removeRenderCellHook(dataKey: string) {
    delete this.globalCache.renderCellHooks[dataKey];
    await this.refresh();
  }

  /**
   * Do initializations. Called in constructor to be async
   */
  private async initializeGlobal() {
    await this.Zotero.uiReadyPromise;
    const window = this.Zotero.getMainWindow() as Window;
    if (!this.Zotero._ItemTreeExtraColumnsGlobal) {
      let globalCache = {
        columns: [],
        fieldHooks: {},
        renderCellHooks: {},
      } as ItemTreeExtraColumnsGlobal;
      this.globalCache = this.Zotero._ItemTreeExtraColumnsGlobal = globalCache;

      // @ts-ignore
      const itemTree = window.require("zotero/itemTree");
      this.tool.patch(
        itemTree.prototype,
        "getColumns",
        this.patchSign,
        (original) =>
          function () {
            // @ts-ignore
            const columns: ColumnOptions[] = original.apply(this, arguments);
            const insertAfter = columns.findIndex(
              (column) => column.dataKey === "title"
            );
            columns.splice(
              insertAfter + 1,
              0,
              ...Zotero._ItemTreeExtraColumnsGlobal.columns
            );
            return columns;
          }
      );
      this.tool.patch(
        itemTree.prototype,
        "_renderCell",
        this.patchSign,
        (original) =>
          function (index: number, data: string, column: ColumnOptions) {
            if (!(column.dataKey in globalCache.renderCellHooks)) {
              // @ts-ignore
              return original.apply(this, arguments);
            }
            const hook = globalCache.renderCellHooks[column.dataKey];
            const elem = hook(index, data, column, original.bind(this));
            if (elem.classList.contains("cell")) {
              return elem;
            }
            const span = window.document.createElementNS(
              "http://www.w3.org/1999/xhtml",
              "span"
            );
            span.classList.add(
              "cell",
              column.dataKey,
              `${column.dataKey}-item-tree-main-default`
            );
            if (column.fixedWidth) {
              span.classList.add("fixed-width");
            }
            span.appendChild(elem);
            return span;
          }
      );
      this.tool.patch(
        this.Zotero.Item.prototype,
        "getField",
        this.patchSign,
        (original) =>
          function (
            field: string,
            unformatted: boolean,
            includeBaseMapped: boolean
          ) {
            if (
              globalCache.columns
                .map((_c: ColumnOptions) => _c.dataKey)
                .includes(field)
            ) {
              try {
                const hook = globalCache.fieldHooks[field];
                // @ts-ignore
                return hook(
                  field,
                  unformatted,
                  includeBaseMapped,
                  this,
                  original.bind(this)
                );
              } catch (e) {
                return field + String(e);
              }
            }
            // @ts-ignore
            return original.apply(this, arguments);
          }
      );
    } else {
      this.globalCache = this.Zotero._ItemTreeExtraColumnsGlobal;
    }
    this.initializationLock.resolve();
  }

  /**
   * Create a React Icon element
   * @param props
   */
  private createIconLabel(props: {
    iconPath: string;
    name: string;
  }): ReactElement {
    // @ts-ignore
    const react = window.require("react");
    return react.createElement(
      "span",
      null,
      react.createElement("img", {
        src: props.iconPath,
        height: "10px",
        width: "9px",
        style: {
          "margin-left": "6px",
        },
      }),
      " ",
      props.name
    );
  }

  /**
   * Refresh itemView. You don't need to call it manually.
   */
  private async refresh() {
    await this.initializationLock.promise;
    const ZoteroPane = this.Zotero.getActiveZoteroPane();
    ZoteroPane.itemsView._columnsId = null;
    const virtualizedTable = ZoteroPane.itemsView.tree?._columns;
    if (!virtualizedTable) {
      this.tool.log("ItemTree is still loading. Refresh skipped.");
      return;
    }
    // Remove style list otherwise the change will not be updated
    document.querySelector(`.${virtualizedTable._styleKey}`)?.remove();
    // Refresh to rebuild _columns
    await ZoteroPane.itemsView.refreshAndMaintainSelection();
    // Construct a new virtualized-table, otherwise it will not be updated
    ZoteroPane.itemsView.tree._columns =
      new virtualizedTable.__proto__.constructor(ZoteroPane.itemsView.tree);
    // Refresh again to totally make the itemView updated
    await ZoteroPane.itemsView.refreshAndMaintainSelection();
  }
}

interface ItemTreeExtraColumnsGlobal {
  columns: ColumnOptions[];
  fieldHooks: {
    [key: string]: (
      field: string,
      unformatted: boolean,
      includeBaseMapped: boolean,
      item: Zotero.Item,
      original: Function
    ) => string;
  };
  renderCellHooks: {
    [key: string]: (
      index: number,
      data: string,
      column: ColumnOptions,
      original: Function
    ) => HTMLElement;
  };
}
