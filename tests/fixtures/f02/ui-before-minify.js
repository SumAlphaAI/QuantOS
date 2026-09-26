"use strict";
(self["webpackChunk_N_E"] = self["webpackChunk_N_E"] || []).push([[311],{

/***/ 9311:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  $n: () => (/* reexport */ Button_Button),
  A: () => (/* reexport */ DangerConfirmDialog),
  MG: () => (/* reexport */ InlineAlert),
  VK: () => (/* reexport */ StateBadge),
  NP: () => (/* reexport */ ThemeProvider)
});

// UNUSED EXPORTS: DataGrid, EvidenceTimeline, I18nProvider, buildDataGridSearchParams, createThemeVariables, designTokens, isDangerConfirmationValid, renderBadge, translate, useI18n, useTheme

;// ../../packages/ui/src/tokens/tokens.json
const tokens_namespaceObject = /*#__PURE__*/JSON.parse('{"$schema":"quantos-design-tokens/v1","meta":{"version":"1.0.0","adr":"docs/adr/20260814-pre02-design-tokens.md","frozenAt":"2026-08-14","note":"语义色不得挪作装饰色；任何变更须 ADR 修订并重新通过 check-contrast"},"color":{"dark":{"surface":{"0":"#0E1420","1":"#161E2E","2":"#1E2839"},"border":{"default":"#2C3A52","strong":"#3D4E6B"},"text":{"primary":"#E8EEF7","secondary":"#A7B4C8","disabled":"#5C6B82","inverse":"#0E1420"},"brand":{"bg":"#0F766E","bgHover":"#115E59","fg":"#FFFFFF"},"semantic":{"success":"#34D399","warning":"#FBBF24","danger":"#F87171","info":"#60A5FA"},"mode":{"research":"#60A5FA","paper":"#34D399","shadow":"#A78BFA","assistedLive":"#F87171"},"chart":{"up":"#2DD4BF","down":"#F87171","categorical":["#2DD4BF","#60A5FA","#A78BFA","#FBBF24","#F87171","#34D399","#F472B6","#94A3B8"]}},"light":{"surface":{"0":"#F7F9FC","1":"#FFFFFF","2":"#EEF2F7"},"border":{"default":"#D4DCE6","strong":"#B8C4D4"},"text":{"primary":"#16202E","secondary":"#47576B","disabled":"#93A1B4","inverse":"#FFFFFF"},"brand":{"bg":"#0F766E","bgHover":"#115E59","fg":"#FFFFFF"},"semantic":{"success":"#047857","warning":"#B45309","danger":"#B91C1C","info":"#1D4ED8"},"mode":{"research":"#1D4ED8","paper":"#047857","shadow":"#6D28D9","assistedLive":"#B91C1C"},"chart":{"up":"#0D9488","down":"#DC2626","categorical":["#0D9488","#1D4ED8","#6D28D9","#B45309","#B91C1C","#047857","#BE185D","#47576B"]}}},"typography":{"fontFamily":{"sans":"Inter, PingFang SC, Microsoft YaHei, system-ui, sans-serif","mono":"JetBrains Mono, SFMono-Regular, Consolas, monospace"},"body":{"fontSize":"14px","lineHeight":"20px"},"table":{"fontSize":"13px","lineHeight":"18px"},"pageTitle":{"fontSize":"24px","lineHeight":"32px","fontWeight":600},"numeric":{"fontVariantNumeric":"tabular-nums","note":"全部金融数值使用等宽数字；ID/hash/correlation ID 使用 mono"}},"spacing":{"base":4,"scale":[0,4,8,12,16,20,24,32,40,48,64]},"density":{"comfortable":{"rowHeight":40,"controlHeight":36,"padding":16},"compact":{"rowHeight":32,"controlHeight":28,"padding":12},"default":"compact","note":"Terminal 默认 compact（专业高密度）；官网固定 comfortable"},"breakpoints":{"full":{"min":1280,"behavior":"完整工作区"},"collapsed":{"min":768,"max":1279,"behavior":"折叠侧栏 + 单列详情"},"readonly":{"max":767,"behavior":"仅状态/只读监控；隐藏审批、下单、撤单、发布等全部高风险操作"},"desktopMin":{"width":1180,"height":760}},"radius":{"sm":4,"md":6,"lg":10},"focus":{"ringWidth":2,"ringColorToken":"semantic.info","note":"焦点环永远可见，不用 outline:none"},"stateEnum":{"task":["queued","running","succeeded","failed","cancelled"],"risk":["allow","deny","approval_required"],"order":["draft","risk_checking","awaiting_approval","command_ready","submitted","accepted","partially_filled","filled","cancelled","rejected","expired"],"market":["live","delayed","stale","unavailable"],"reconciliation":["matched","investigating","resolved"],"unknownFallback":"未知/需升级：未知枚举显示该标识并阻断高风险动作，不落入默认 allow"},"stateColor":{"queued":"text.secondary","running":"semantic.info","succeeded":"semantic.success","failed":"semantic.danger","cancelled":"text.secondary","allow":"semantic.success","deny":"semantic.danger","approval_required":"semantic.warning","draft":"text.secondary","risk_checking":"semantic.info","awaiting_approval":"semantic.warning","command_ready":"semantic.info","submitted":"semantic.info","accepted":"semantic.info","partially_filled":"semantic.warning","filled":"semantic.success","rejected":"semantic.danger","expired":"semantic.danger","live":"semantic.success","delayed":"semantic.warning","stale":"semantic.warning","unavailable":"semantic.danger","matched":"semantic.success","investigating":"semantic.warning","resolved":"semantic.success"}}');
;// ../../packages/ui/src/tokens/index.ts

const tokens_designTokens = tokens_namespaceObject;
/* harmony default export */ const tokens = (tokens_designTokens);

// EXTERNAL MODULE: ../../node_modules/.pnpm/next@15.5.24_@playwright+test@1.62.1_@types+node@24.3.0_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/next/dist/compiled/react/jsx-runtime.js
var jsx_runtime = __webpack_require__(6271);
;// ../../packages/ui/src/components/StateBadge/StateBadge.tsx


const StateBadge_tokens = tokens;
const ICONS = {
    "semantic.success": "●",
    "semantic.warning": "▲",
    "semantic.danger": "■",
    "semantic.info": "◆",
    "text.secondary": "○"
};
const UNKNOWN_LABEL = {
    en: "Unknown / upgrade required",
    "zh-CN": "未知/需升级"
};
function resolveColorToken(state) {
    var _tokens_stateColor_state;
    return (_tokens_stateColor_state = StateBadge_tokens.stateColor[state]) !== null && _tokens_stateColor_state !== void 0 ? _tokens_stateColor_state : "semantic.warning";
}
function resolveHex(tokenPath, theme) {
    var _palette_group;
    const [group, key] = tokenPath.split(".");
    const palette = StateBadge_tokens.color[theme];
    var _palette_group_key;
    return (_palette_group_key = (_palette_group = palette[group]) === null || _palette_group === void 0 ? void 0 : _palette_group[key]) !== null && _palette_group_key !== void 0 ? _palette_group_key : StateBadge_tokens.color[theme].semantic.warning;
}
function StateBadge(param) {
    let { state, label, locale = "zh-CN", theme = "dark" } = param;
    const known = state in StateBadge_tokens.stateColor;
    const tokenPath = resolveColorToken(state);
    const color = resolveHex(tokenPath, theme);
    const text = known ? label !== null && label !== void 0 ? label : state : UNKNOWN_LABEL[locale];
    var _ICONS_tokenPath;
    return /*#__PURE__*/ (0,jsx_runtime.jsxs)("span", {
        role: "status",
        "aria-label": text,
        style: {
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color,
            fontSize: 13,
            lineHeight: "18px",
            fontVariantNumeric: "tabular-nums"
        },
        children: [
            /*#__PURE__*/ (0,jsx_runtime.jsx)("span", {
                "aria-hidden": "true",
                children: (_ICONS_tokenPath = ICONS[tokenPath]) !== null && _ICONS_tokenPath !== void 0 ? _ICONS_tokenPath : "▲"
            }),
            /*#__PURE__*/ (0,jsx_runtime.jsx)("span", {
                children: text
            })
        ]
    });
}
/* harmony default export */ const StateBadge_StateBadge = ((/* unused pure expression or super */ null && (StateBadge)));

;// ../../packages/ui/src/components/Button/Button.tsx
/* __next_internal_client_entry_do_not_use__ Button auto */ 
function Button_Button(param) {
    let { variant = "default", loading = false, disabled, children, className, ...props } = param;
    return /*#__PURE__*/ (0,jsx_runtime.jsx)("button", {
        ...props,
        className: "q-button q-button--".concat(variant).concat(className ? " ".concat(className) : ""),
        disabled: disabled || loading,
        "aria-busy": loading || undefined,
        children: loading ? /*#__PURE__*/ (0,jsx_runtime.jsxs)(jsx_runtime.Fragment, {
            children: [
                /*#__PURE__*/ (0,jsx_runtime.jsx)("span", {
                    "aria-hidden": "true",
                    children: "↻"
                }),
                " ",
                children
            ]
        }) : children
    });
}

;// ../../packages/ui/src/components/InlineAlert/InlineAlert.tsx

const colors = {
    info: "var(--q-info)",
    success: "var(--q-success)",
    warning: "var(--q-warning)",
    danger: "var(--q-danger)"
};
function InlineAlert(param) {
    let { tone = "info", title, children } = param;
    return /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
        className: "q-alert",
        role: tone === "danger" ? "alert" : "status",
        style: {
            "--q-alert-color": colors[tone]
        },
        children: [
            /*#__PURE__*/ (0,jsx_runtime.jsx)("p", {
                className: "q-alert__title",
                children: title
            }),
            children ? /*#__PURE__*/ (0,jsx_runtime.jsx)("div", {
                className: "q-alert__message",
                children: children
            }) : null
        ]
    });
}

// EXTERNAL MODULE: ../../node_modules/.pnpm/next@15.5.24_@playwright+test@1.62.1_@types+node@24.3.0_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/next/dist/compiled/react/index.js
var react = __webpack_require__(2487);
;// ../../packages/ui/src/components/DataGrid/DataGrid.tsx
/* __next_internal_client_entry_do_not_use__ buildDataGridSearchParams,DataGrid auto */ 



const stateTitles = {
    loading: "正在加载",
    empty: "暂无数据",
    error: "加载失败",
    unauthorized: "无权访问",
    stale: "数据已陈旧",
    offline: "当前离线"
};
function GridState(param) {
    let { state, message, correlationId } = param;
    return /*#__PURE__*/ _jsx("div", {
        className: "q-state",
        role: state === "error" ? "alert" : "status",
        "aria-live": "polite",
        children: /*#__PURE__*/ _jsxs("div", {
            className: "q-state__content",
            children: [
                /*#__PURE__*/ _jsx("p", {
                    className: "q-state__title",
                    children: stateTitles[state]
                }),
                message ? /*#__PURE__*/ _jsx("p", {
                    className: "q-state__message",
                    children: message
                }) : null,
                correlationId ? /*#__PURE__*/ _jsxs("p", {
                    className: "q-state__message q-mono",
                    children: [
                        "Correlation ID: ",
                        correlationId
                    ]
                }) : null
            ]
        })
    });
}
function buildDataGridSearchParams(input) {
    let namespace = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "grid";
    var _input_visibleColumnIds;
    const params = new URLSearchParams();
    const prefix = "".concat(namespace, ".");
    if (input.page && input.page > 1) params.set("".concat(prefix, "page"), String(input.page));
    if (input.sort) {
        params.set("".concat(prefix, "sort"), input.sort.columnId);
        params.set("".concat(prefix, "direction"), input.sort.direction);
    }
    var _input_filters;
    for (const filter of (_input_filters = input.filters) !== null && _input_filters !== void 0 ? _input_filters : [])if (filter.value) params.set("".concat(prefix, "filter.").concat(filter.id), filter.value);
    if ((_input_visibleColumnIds = input.visibleColumnIds) === null || _input_visibleColumnIds === void 0 ? void 0 : _input_visibleColumnIds.length) params.set("".concat(prefix, "columns"), input.visibleColumnIds.join(","));
    return params;
}
function DataGrid(param) {
    let { title, columns, rows, rowKey, state = "default", stateMessage, correlationId, page = 1, pageCount = 1, sort, filters = [], onFilterChange, visibleColumnIds, onVisibleColumnIdsChange, virtualize = false, viewportRows = 10, urlSync, onSortChange, onPageChange, toolbar } = param;
    const effectiveState = state === "default" && rows.length === 0 ? "empty" : state;
    const [scrollTop, setScrollTop] = useState(0);
    const rowHeight = designTokens.density.compact.rowHeight;
    const overscan = 3;
    const visibleColumns = useMemo(()=>visibleColumnIds ? columns.filter((column)=>visibleColumnIds.includes(column.id)) : columns, [
        columns,
        visibleColumnIds
    ]);
    const startIndex = virtualize ? Math.max(0, Math.floor(scrollTop / rowHeight) - overscan) : 0;
    const endIndex = virtualize ? Math.min(rows.length, startIndex + viewportRows + overscan * 2) : rows.length;
    const visibleRows = virtualize ? rows.slice(startIndex, endIndex) : rows;
    const pinnedLeft = new Map();
    let left = 0;
    for (const column of visibleColumns)if (column.pinned === "left") {
        pinnedLeft.set(column.id, left);
        var _column_width;
        left += (_column_width = column.width) !== null && _column_width !== void 0 ? _column_width : 160;
    }
    useEffect(()=>{
        if (!(urlSync === null || urlSync === void 0 ? void 0 : urlSync.enabled) || "object" === "undefined") return;
        const managed = buildDataGridSearchParams({
            page,
            sort,
            filters,
            visibleColumnIds
        }, urlSync.namespace);
        const next = new URL(window.location.href);
        var _urlSync_namespace;
        const prefix = "".concat((_urlSync_namespace = urlSync.namespace) !== null && _urlSync_namespace !== void 0 ? _urlSync_namespace : "grid", ".");
        for (const key of [
            ...next.searchParams.keys()
        ])if (key.startsWith(prefix)) next.searchParams.delete(key);
        managed.forEach((value, key)=>next.searchParams.set(key, value));
        window.history[urlSync.mode === "push" ? "pushState" : "replaceState"]({}, "", next);
    }, [
        filters,
        page,
        sort,
        urlSync,
        visibleColumnIds
    ]);
    function pinnedStyle(column) {
        if (!column.pinned) return column.width ? {
            width: column.width,
            minWidth: column.width
        } : undefined;
        var _column_width;
        return {
            position: "sticky",
            [column.pinned]: column.pinned === "left" ? pinnedLeft.get(column.id) : 0,
            width: column.width,
            minWidth: (_column_width = column.width) !== null && _column_width !== void 0 ? _column_width : 160,
            zIndex: 2,
            background: "var(--q-surface-1)"
        };
    }
    function onScroll(event) {
        if (virtualize) setScrollTop(event.currentTarget.scrollTop);
    }
    function toggleColumn(columnId, checked) {
        const current = visibleColumnIds !== null && visibleColumnIds !== void 0 ? visibleColumnIds : columns.map((column)=>column.id);
        onVisibleColumnIdsChange === null || onVisibleColumnIdsChange === void 0 ? void 0 : onVisibleColumnIdsChange(checked ? [
            ...current,
            columnId
        ] : current.filter((id)=>id !== columnId));
    }
    return /*#__PURE__*/ _jsxs("section", {
        className: "q-panel",
        "aria-labelledby": "".concat(title.replace(/\s+/g, "-").toLowerCase(), "-title"),
        "aria-busy": state === "loading" || undefined,
        children: [
            /*#__PURE__*/ _jsxs("header", {
                className: "q-panel__header",
                children: [
                    /*#__PURE__*/ _jsx("h2", {
                        className: "q-panel__title",
                        id: "".concat(title.replace(/\s+/g, "-").toLowerCase(), "-title"),
                        children: title
                    }),
                    /*#__PURE__*/ _jsxs("div", {
                        className: "q-row",
                        children: [
                            toolbar,
                            onVisibleColumnIdsChange ? /*#__PURE__*/ _jsxs("details", {
                                className: "q-column-menu",
                                children: [
                                    /*#__PURE__*/ _jsx("summary", {
                                        children: "显示列"
                                    }),
                                    /*#__PURE__*/ _jsx("div", {
                                        className: "q-column-menu__body",
                                        children: columns.map((column)=>{
                                            var _visibleColumnIds_includes;
                                            const checked = (_visibleColumnIds_includes = visibleColumnIds === null || visibleColumnIds === void 0 ? void 0 : visibleColumnIds.includes(column.id)) !== null && _visibleColumnIds_includes !== void 0 ? _visibleColumnIds_includes : true;
                                            return /*#__PURE__*/ _jsxs("label", {
                                                children: [
                                                    /*#__PURE__*/ _jsx("input", {
                                                        type: "checkbox",
                                                        checked: checked,
                                                        disabled: checked && visibleColumns.length === 1,
                                                        onChange: (event)=>toggleColumn(column.id, event.target.checked)
                                                    }),
                                                    " ",
                                                    column.header
                                                ]
                                            }, column.id);
                                        })
                                    })
                                ]
                            }) : null
                        ]
                    })
                ]
            }),
            filters.length ? /*#__PURE__*/ _jsx("div", {
                className: "q-filters",
                "aria-label": "".concat(title, " 过滤条件"),
                children: filters.map((filter)=>/*#__PURE__*/ _jsxs("label", {
                        className: "q-field q-field--inline",
                        children: [
                            filter.label,
                            /*#__PURE__*/ _jsx("input", {
                                className: "q-input",
                                type: "search",
                                value: filter.value,
                                placeholder: filter.placeholder,
                                onChange: (event)=>onFilterChange === null || onFilterChange === void 0 ? void 0 : onFilterChange(filter.id, event.target.value)
                            })
                        ]
                    }, filter.id))
            }) : null,
            effectiveState !== "default" ? /*#__PURE__*/ _jsx(GridState, {
                state: effectiveState,
                message: stateMessage,
                correlationId: correlationId
            }) : /*#__PURE__*/ _jsxs(_Fragment, {
                children: [
                    /*#__PURE__*/ _jsx("div", {
                        className: "q-table-wrap".concat(virtualize ? " q-table-wrap--virtual" : ""),
                        style: virtualize ? {
                            maxHeight: rowHeight * viewportRows
                        } : undefined,
                        onScroll: onScroll,
                        children: /*#__PURE__*/ _jsxs("table", {
                            className: "q-table",
                            children: [
                                /*#__PURE__*/ _jsx("thead", {
                                    children: /*#__PURE__*/ _jsx("tr", {
                                        children: visibleColumns.map((column)=>/*#__PURE__*/ _jsx("th", {
                                                scope: "col",
                                                style: pinnedStyle(column),
                                                "aria-sort": (sort === null || sort === void 0 ? void 0 : sort.columnId) === column.id ? sort.direction === "asc" ? "ascending" : "descending" : undefined,
                                                children: column.sortable ? /*#__PURE__*/ _jsxs("button", {
                                                    className: "q-sort",
                                                    type: "button",
                                                    onClick: ()=>onSortChange === null || onSortChange === void 0 ? void 0 : onSortChange(column.id, (sort === null || sort === void 0 ? void 0 : sort.columnId) === column.id && sort.direction === "asc" ? "desc" : "asc"),
                                                    children: [
                                                        column.header,
                                                        (sort === null || sort === void 0 ? void 0 : sort.columnId) === column.id ? /*#__PURE__*/ _jsxs("span", {
                                                            "aria-hidden": "true",
                                                            children: [
                                                                " ",
                                                                sort.direction === "asc" ? "↑" : "↓"
                                                            ]
                                                        }) : null
                                                    ]
                                                }) : column.header
                                            }, column.id))
                                    })
                                }),
                                /*#__PURE__*/ _jsxs("tbody", {
                                    children: [
                                        virtualize && startIndex > 0 ? /*#__PURE__*/ _jsx("tr", {
                                            "aria-hidden": "true",
                                            children: /*#__PURE__*/ _jsx("td", {
                                                colSpan: visibleColumns.length,
                                                style: {
                                                    height: startIndex * rowHeight,
                                                    padding: 0,
                                                    border: 0
                                                }
                                            })
                                        }) : null,
                                        visibleRows.map((row)=>/*#__PURE__*/ _jsx("tr", {
                                                children: visibleColumns.map((column)=>/*#__PURE__*/ _jsx("td", {
                                                        style: pinnedStyle(column),
                                                        className: column.numeric ? "q-mono" : undefined,
                                                        children: column.cell(row)
                                                    }, column.id))
                                            }, rowKey(row))),
                                        virtualize && endIndex < rows.length ? /*#__PURE__*/ _jsx("tr", {
                                            "aria-hidden": "true",
                                            children: /*#__PURE__*/ _jsx("td", {
                                                colSpan: visibleColumns.length,
                                                style: {
                                                    height: (rows.length - endIndex) * rowHeight,
                                                    padding: 0,
                                                    border: 0
                                                }
                                            })
                                        }) : null
                                    ]
                                })
                            ]
                        })
                    }),
                    pageCount > 1 ? /*#__PURE__*/ _jsxs("nav", {
                        className: "q-pagination",
                        "aria-label": "".concat(title, " 分页"),
                        children: [
                            /*#__PURE__*/ _jsx(Button, {
                                disabled: page <= 1,
                                onClick: ()=>onPageChange === null || onPageChange === void 0 ? void 0 : onPageChange(page - 1),
                                children: "上一页"
                            }),
                            /*#__PURE__*/ _jsxs("span", {
                                "aria-live": "polite",
                                children: [
                                    "第 ",
                                    page,
                                    " / ",
                                    pageCount,
                                    " 页"
                                ]
                            }),
                            /*#__PURE__*/ _jsx(Button, {
                                disabled: page >= pageCount,
                                onClick: ()=>onPageChange === null || onPageChange === void 0 ? void 0 : onPageChange(page + 1),
                                children: "下一页"
                            })
                        ]
                    }) : null
                ]
            })
        ]
    });
}

;// ../../packages/ui/src/components/EvidenceTimeline/EvidenceTimeline.tsx

const stateLabels = {
    loading: "正在加载证据链",
    empty: "暂无证据事件",
    error: "证据链加载失败",
    unauthorized: "无权查看证据链",
    stale: "证据链数据已陈旧",
    offline: "离线缓存证据链"
};
function EvidenceTimeline(param) {
    let { title, events, state = "default", stateMessage } = param;
    const effectiveState = state === "default" && events.length === 0 ? "empty" : state;
    return /*#__PURE__*/ _jsxs("section", {
        className: "q-panel",
        "aria-labelledby": "".concat(title.replace(/\s+/g, "-").toLowerCase(), "-title"),
        "aria-busy": state === "loading" || undefined,
        children: [
            /*#__PURE__*/ _jsx("header", {
                className: "q-panel__header",
                children: /*#__PURE__*/ _jsx("h2", {
                    className: "q-panel__title",
                    id: "".concat(title.replace(/\s+/g, "-").toLowerCase(), "-title"),
                    children: title
                })
            }),
            effectiveState !== "default" ? /*#__PURE__*/ _jsx("div", {
                className: "q-state",
                role: effectiveState === "error" ? "alert" : "status",
                children: /*#__PURE__*/ _jsxs("div", {
                    className: "q-state__content",
                    children: [
                        /*#__PURE__*/ _jsx("p", {
                            className: "q-state__title",
                            children: stateLabels[effectiveState]
                        }),
                        stateMessage ? /*#__PURE__*/ _jsx("p", {
                            className: "q-state__message",
                            children: stateMessage
                        }) : null
                    ]
                })
            }) : /*#__PURE__*/ _jsx("ol", {
                className: "q-timeline",
                children: events.map((item)=>/*#__PURE__*/ _jsxs("li", {
                        className: "q-timeline__item",
                        children: [
                            /*#__PURE__*/ _jsx("time", {
                                className: "q-timeline__time",
                                dateTime: item.timestamp,
                                children: item.timestamp
                            }),
                            /*#__PURE__*/ _jsxs("div", {
                                children: [
                                    /*#__PURE__*/ _jsx("p", {
                                        className: "q-timeline__event",
                                        children: item.event
                                    }),
                                    /*#__PURE__*/ _jsxs("p", {
                                        className: "q-timeline__meta",
                                        children: [
                                            item.actor,
                                            " \xb7 ",
                                            item.state
                                        ]
                                    }),
                                    /*#__PURE__*/ _jsxs("p", {
                                        className: "q-timeline__meta q-mono",
                                        children: [
                                            "Correlation ID: ",
                                            item.correlationId
                                        ]
                                    }),
                                    item.details ? /*#__PURE__*/ _jsxs("details", {
                                        children: [
                                            /*#__PURE__*/ _jsx("summary", {
                                                children: "查看证据详情"
                                            }),
                                            item.details
                                        ]
                                    }) : null
                                ]
                            })
                        ]
                    }, item.id))
            })
        ]
    });
}

// EXTERNAL MODULE: ../../node_modules/.pnpm/@radix-ui+react-dialog@1.1.23_@types+react-dom@19.2.4_@types+react@19.2.18__@types+reac_f43cda4f5f60c6fd8f384ced683c6d90/node_modules/@radix-ui/react-dialog/dist/index.mjs + 39 modules
var dist = __webpack_require__(5852);
;// ../../packages/ui/src/theme/ThemeProvider.tsx
/* __next_internal_client_entry_do_not_use__ createThemeVariables,ThemeProvider,useTheme auto */ 


const ThemeContext = /*#__PURE__*/ (0,react.createContext)(null);
function createThemeVariables(theme) {
    const color = tokens.color[theme];
    const spacing = tokens.spacing.scale;
    return {
        "--q-color-scheme": theme,
        "--q-surface-0": color.surface["0"],
        "--q-surface-1": color.surface["1"],
        "--q-surface-2": color.surface["2"],
        "--q-border": color.border.default,
        "--q-border-strong": color.border.strong,
        "--q-text-primary": color.text.primary,
        "--q-text-secondary": color.text.secondary,
        "--q-text-disabled": color.text.disabled,
        "--q-brand": color.brand.bg,
        "--q-brand-hover": color.brand.bgHover,
        "--q-brand-fg": color.brand.fg,
        "--q-success": color.semantic.success,
        "--q-warning": color.semantic.warning,
        "--q-danger": color.semantic.danger,
        "--q-info": color.semantic.info,
        "--q-focus": color.semantic.info,
        "--q-focus-width": "".concat(tokens.focus.ringWidth, "px"),
        "--q-font-sans": tokens.typography.fontFamily.sans,
        "--q-font-mono": tokens.typography.fontFamily.mono,
        "--q-font-body-size": tokens.typography.body.fontSize,
        "--q-font-body-line": tokens.typography.body.lineHeight,
        "--q-font-table-size": tokens.typography.table.fontSize,
        "--q-font-table-line": tokens.typography.table.lineHeight,
        "--q-font-page-size": tokens.typography.pageTitle.fontSize,
        "--q-font-page-line": tokens.typography.pageTitle.lineHeight,
        "--q-space-1": "".concat(spacing[1], "px"),
        "--q-space-2": "".concat(spacing[2], "px"),
        "--q-space-3": "".concat(spacing[3], "px"),
        "--q-space-4": "".concat(spacing[4], "px"),
        "--q-space-5": "".concat(spacing[5], "px"),
        "--q-radius-sm": "".concat(tokens.radius.sm, "px"),
        "--q-radius-md": "".concat(tokens.radius.md, "px"),
        "--q-radius-lg": "".concat(tokens.radius.lg, "px"),
        "--q-control-height": "".concat(tokens.density.compact.controlHeight, "px"),
        "--q-row-height": "".concat(tokens.density.compact.rowHeight, "px")
    };
}
function ThemeProvider(param) {
    let { children, defaultTheme = "dark", theme: controlledTheme, onThemeChange, className } = param;
    const [internalTheme, setInternalTheme] = (0,react.useState)(defaultTheme);
    const theme = controlledTheme !== null && controlledTheme !== void 0 ? controlledTheme : internalTheme;
    const value = (0,react.useMemo)(()=>({
            theme,
            setTheme (next) {
                if (controlledTheme === undefined) setInternalTheme(next);
                onThemeChange === null || onThemeChange === void 0 ? void 0 : onThemeChange(next);
            }
        }), [
        controlledTheme,
        onThemeChange,
        theme
    ]);
    return /*#__PURE__*/ (0,jsx_runtime.jsx)(ThemeContext.Provider, {
        value: value,
        children: /*#__PURE__*/ (0,jsx_runtime.jsx)("div", {
            className: "quantos-theme".concat(className ? " ".concat(className) : ""),
            "data-quantos-theme": theme,
            style: createThemeVariables(theme),
            children: children
        })
    });
}
function useTheme() {
    const context = (0,react.useContext)(ThemeContext);
    if (!context) throw new Error("useTheme must be used inside ThemeProvider");
    return context;
}

;// ../../packages/ui/src/components/DangerConfirmDialog/DangerConfirmDialog.tsx
/* __next_internal_client_entry_do_not_use__ isDangerConfirmationValid,DangerConfirmDialog auto */ 





function isDangerConfirmationValid(phrase, expectedPhrase, mfaRequired, mfaCode) {
    return phrase === expectedPhrase && (!mfaRequired || /^\d{6}$/.test(mfaCode));
}
function DangerConfirmDialog(param) {
    let { trigger, title, summary, impact, confirmPhrase, confirmLabel, mfaRequired = false, finalCheckLabel = "服务端最终校验将在提交时再次执行", correlationId, onConfirm } = param;
    const { theme } = useTheme();
    const [open, setOpen] = (0,react.useState)(false);
    const [phrase, setPhrase] = (0,react.useState)("");
    const [mfaCode, setMfaCode] = (0,react.useState)("");
    const [pending, setPending] = (0,react.useState)(false);
    const [error, setError] = (0,react.useState)();
    const cancelRef = (0,react.useRef)(null);
    const phraseId = (0,react.useId)();
    const mfaId = (0,react.useId)();
    const valid = isDangerConfirmationValid(phrase, confirmPhrase, mfaRequired, mfaCode);
    function reset() {
        setPhrase("");
        setMfaCode("");
        setError(undefined);
    }
    async function submit() {
        if (!valid || pending) return;
        setPending(true);
        setError(undefined);
        try {
            await onConfirm({
                phrase,
                mfaCode: mfaRequired ? mfaCode : undefined
            });
            setOpen(false);
            reset();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "操作未完成，请重试");
        } finally{
            setPending(false);
        }
    }
    return /*#__PURE__*/ (0,jsx_runtime.jsxs)(dist/* Root */.bL, {
        open: open,
        onOpenChange: (next)=>{
            if (!pending) {
                setOpen(next);
                if (!next) reset();
            }
        },
        children: [
            /*#__PURE__*/ (0,jsx_runtime.jsx)(dist/* Trigger */.l9, {
                asChild: true,
                children: trigger
            }),
            /*#__PURE__*/ (0,jsx_runtime.jsxs)(dist/* Portal */.ZL, {
                children: [
                    /*#__PURE__*/ (0,jsx_runtime.jsx)(dist/* Overlay */.hJ, {
                        className: "q-dialog-overlay"
                    }),
                    /*#__PURE__*/ (0,jsx_runtime.jsxs)(dist/* Content */.UC, {
                        className: "q-dialog-content quantos-theme",
                        style: createThemeVariables(theme),
                        onOpenAutoFocus: (event)=>{
                            var _cancelRef_current;
                            event.preventDefault();
                            (_cancelRef_current = cancelRef.current) === null || _cancelRef_current === void 0 ? void 0 : _cancelRef_current.focus();
                        },
                        onEscapeKeyDown: (event)=>{
                            if (pending) event.preventDefault();
                        },
                        onInteractOutside: (event)=>{
                            if (pending) event.preventDefault();
                        },
                        children: [
                            /*#__PURE__*/ (0,jsx_runtime.jsx)(dist/* Title */.hE, {
                                className: "q-dialog-title",
                                children: title
                            }),
                            /*#__PURE__*/ (0,jsx_runtime.jsx)(dist/* Description */.VY, {
                                className: "q-dialog-description",
                                children: summary
                            }),
                            /*#__PURE__*/ (0,jsx_runtime.jsx)(InlineAlert, {
                                tone: "danger",
                                title: "不可逆操作警告",
                                children: impact
                            }),
                            /*#__PURE__*/ (0,jsx_runtime.jsxs)("label", {
                                className: "q-field",
                                htmlFor: phraseId,
                                children: [
                                    "输入“",
                                    confirmPhrase,
                                    "”以确认",
                                    /*#__PURE__*/ (0,jsx_runtime.jsx)("input", {
                                        className: "q-input",
                                        id: phraseId,
                                        autoComplete: "off",
                                        value: phrase,
                                        onChange: (event)=>setPhrase(event.target.value)
                                    })
                                ]
                            }),
                            mfaRequired ? /*#__PURE__*/ (0,jsx_runtime.jsxs)("label", {
                                className: "q-field",
                                htmlFor: mfaId,
                                children: [
                                    "MFA 验证码",
                                    /*#__PURE__*/ (0,jsx_runtime.jsx)("input", {
                                        className: "q-input q-mono",
                                        id: mfaId,
                                        inputMode: "numeric",
                                        autoComplete: "one-time-code",
                                        maxLength: 6,
                                        value: mfaCode,
                                        onChange: (event)=>setMfaCode(event.target.value.replace(/\D/g, ""))
                                    })
                                ]
                            }) : null,
                            /*#__PURE__*/ (0,jsx_runtime.jsxs)("p", {
                                className: "q-muted",
                                children: [
                                    "✓ ",
                                    finalCheckLabel
                                ]
                            }),
                            correlationId ? /*#__PURE__*/ (0,jsx_runtime.jsxs)("p", {
                                className: "q-muted q-mono",
                                children: [
                                    "Correlation ID: ",
                                    correlationId
                                ]
                            }) : null,
                            error ? /*#__PURE__*/ (0,jsx_runtime.jsx)(InlineAlert, {
                                tone: "danger",
                                title: "提交失败",
                                children: error
                            }) : null,
                            /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
                                className: "q-dialog-actions",
                                children: [
                                    /*#__PURE__*/ (0,jsx_runtime.jsx)(dist/* Close */.bm, {
                                        asChild: true,
                                        children: /*#__PURE__*/ (0,jsx_runtime.jsx)("button", {
                                            className: "q-button q-button--default",
                                            type: "button",
                                            ref: cancelRef,
                                            disabled: pending,
                                            children: "取消"
                                        })
                                    }),
                                    /*#__PURE__*/ (0,jsx_runtime.jsx)(Button_Button, {
                                        type: "button",
                                        variant: "danger",
                                        disabled: !valid,
                                        loading: pending,
                                        onClick: ()=>void submit(),
                                        children: confirmLabel
                                    })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
}

;// ../../packages/ui/src/i18n/en.json
const en_namespaceObject = /*#__PURE__*/JSON.parse('{"safety.mode.paper":"PAPER · Paper trading ledger. No orders will be submitted to any venue.","safety.mode.shadow":"SHADOW · Shadow results are generated from live market data for comparison only. No orders will be submitted.","safety.mode.assistedLiveUnavailable":"Assisted Live is not available yet. It requires the M5 Gate and a separate approval.","safety.dataStale":"Data has exceeded its allowed freshness window. Refresh the data or wait for recovery before continuing.","safety.forbidden":"You do not have permission to access this resource. If you believe this is an error, contact your primary workspace administrator.","safety.nonExecutableProposal":"This is a trade proposal, not an order. Complete the deterministic risk evaluation and required approvals first.","safety.commandExpired":"This trade command has expired and cannot be submitted. Run the risk evaluation again.","safety.noVenue":"No authorized and healthy venue is currently available for this instrument. Check connection status or contact your administrator.","safety.priceChanged":"The quote has changed and the order has not been submitted. Review the latest price and estimated cost before continuing.","safety.performanceBasis":"Performance is based on confirmed ledger entries and valuation snapshots, and does not represent future results.","safety.reconciliationBreak":"A discrepancy between the ledger and external reports was detected. It is under investigation and must not be used to adjust trading decisions.","safety.offline":"Connection lost. Read-only cache remains available; creation, approval and trading actions are paused.","safety.reauth":"This action affects trading risk. Complete identity verification to continue.","safety.approvalRecorded":"Approval recorded. The system will continue with the remaining deterministic checks.","safety.approvalRejected":"The request has been rejected. The reason and rule context have been written to the audit trail.","safety.killSwitch":"Kill switch is engaged. The system rejects new trade commands until it is released by authorized personnel.","safety.loadFailed":"This page could not be loaded. Retry; if the problem persists, copy the correlation ID and contact support.","safety.noResults":"No results match the current filters. Adjust the filters or clear them.","state.unknown":"Unknown / upgrade required"}');
;// ../../packages/ui/src/i18n/zh-CN.json
const zh_CN_namespaceObject = /*#__PURE__*/JSON.parse('{"safety.mode.paper":"PAPER · 模拟账本。不会向交易所提交订单。","safety.mode.shadow":"SHADOW · 基于真实行情生成对照结果，不会提交订单。","safety.mode.assistedLiveUnavailable":"Assisted Live 尚未开放。需完成 M5 Gate 并获得单独批准。","safety.dataStale":"数据已超过允许时效。请刷新数据或等待数据恢复后再继续。","safety.forbidden":"你没有访问此资源的权限。若认为这是错误，请联系主工作区管理员。","safety.nonExecutableProposal":"这是交易建议，不是订单。请先完成确定性风险评估和必要审批。","safety.commandExpired":"该交易命令已失效，无法提交。请重新进行风险评估。","safety.noVenue":"当前没有可用于该标的的已授权健康交易所。请检查连接状态或联系管理员。","safety.priceChanged":"报价已变化，订单尚未提交。请复核最新价格和预计成本后继续。","safety.performanceBasis":"收益基于已确认的账本与估值快照，不代表未来表现。","safety.reconciliationBreak":"发现账本与外部回报差异。该差异正在调查中，不应据此调整交易决策。","safety.offline":"连接已断开。只读缓存仍可用；创建、审批和交易操作已暂停。","safety.reauth":"此操作会影响交易风险。请完成身份验证后继续。","safety.approvalRecorded":"审批已记录。系统将继续执行后续确定性校验。","safety.approvalRejected":"已拒绝该请求。拒绝理由与规则上下文已写入审计记录。","safety.killSwitch":"紧急停止已启用。系统拒绝新的交易命令，直至由授权人员解除。","safety.loadFailed":"暂时无法加载此页面。请重试；如果问题持续，请复制关联 ID 联系支持。","safety.noResults":"未找到符合当前筛选条件的结果。请调整筛选或清除条件。","state.unknown":"未知/需升级"}');
;// ../../packages/ui/src/i18n/I18nProvider.tsx
/* __next_internal_client_entry_do_not_use__ translate,I18nProvider,useI18n auto */ 



const dictionaries = {
    en: en_namespaceObject,
    "zh-CN": zh_CN_namespaceObject
};
function translate(locale, key) {
    let values = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
    var _dictionaries_locale_key, _ref;
    const template = (_ref = (_dictionaries_locale_key = dictionaries[locale][key]) !== null && _dictionaries_locale_key !== void 0 ? _dictionaries_locale_key : dictionaries.en[key]) !== null && _ref !== void 0 ? _ref : key;
    return template.replace(/\{(\w+)\}/g, (_, name)=>{
        var _values_name;
        return String((_values_name = values[name]) !== null && _values_name !== void 0 ? _values_name : "{".concat(name, "}"));
    });
}
const I18nContext = /*#__PURE__*/ (/* unused pure expression or super */ null && (createContext(null)));
function I18nProvider(param) {
    let { children, defaultLocale = "zh-CN", locale: controlledLocale, onLocaleChange } = param;
    const [internalLocale, setInternalLocale] = useState(defaultLocale);
    const locale = controlledLocale !== null && controlledLocale !== void 0 ? controlledLocale : internalLocale;
    const value = useMemo(()=>({
            locale,
            setLocale (next) {
                if (controlledLocale === undefined) setInternalLocale(next);
                onLocaleChange === null || onLocaleChange === void 0 ? void 0 : onLocaleChange(next);
            },
            t: (key, values)=>translate(locale, key, values)
        }), [
        controlledLocale,
        locale,
        onLocaleChange
    ]);
    return /*#__PURE__*/ _jsx(I18nContext.Provider, {
        value: value,
        children: children
    });
}
function useI18n() {
    const context = useContext(I18nContext);
    if (!context) throw new Error("useI18n must be used inside I18nProvider");
    return context;
}

;// ../../packages/ui/src/index.ts
function renderBadge(label) {
    return "[".concat(label, "]");
}












/***/ })

}]);