<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [zotero-plugin-toolkit](./zotero-plugin-toolkit.md) &gt; [ZoteroCompat](./zotero-plugin-toolkit.zoterocompat.md) &gt; [parseXHTMLToFragment](./zotero-plugin-toolkit.zoterocompat.parsexhtmltofragment.md)

## ZoteroCompat.parseXHTMLToFragment() method

Parse XHTML to XUL fragment. For Zotero 6.

To load preferences from a Zotero 7's `.xhtml`<!-- -->, use this method to parse it.

<b>Signature:</b>

```typescript
parseXHTMLToFragment(str: string, entities?: string[], defaultXUL?: boolean): DocumentFragment;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  str | string | xhtml raw text |
|  entities | string\[\] | <i>(Optional)</i> dtd file list ("chrome://xxx.dtd") |
|  defaultXUL | boolean | <i>(Optional)</i> true for default XUL namespace |

<b>Returns:</b>

DocumentFragment
