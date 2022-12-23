<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [zotero-plugin-toolkit](./zotero-plugin-toolkit.md) &gt; [ZoteroTool](./zotero-plugin-toolkit.zoterotool.md) &gt; [openFilePicker](./zotero-plugin-toolkit.zoterotool.openfilepicker.md)

## ZoteroTool.openFilePicker() method

Open a file picker

<b>Signature:</b>

```typescript
openFilePicker(title: string, mode: "open" | "save" | "folder", filters?: [string, string][], suggestion?: string): Promise<unknown>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  title | string | window title |
|  mode | "open" \| "save" \| "folder" |  |
|  filters | \[string, string\]\[\] | <i>(Optional)</i> Array<!-- -->&lt;<!-- -->\[hint string, filter string\]<!-- -->&gt; |
|  suggestion | string | <i>(Optional)</i> default file/foler |

<b>Returns:</b>

Promise&lt;unknown&gt;

## Example


```ts
const tool = new ZoteroTool();
await tool.openFilePicker(
        `${Zotero.getString("fileInterface.import")} MarkDown Document`,
        "open",
        [["MarkDown File(*.md)", "*.md"]]
      );
```
