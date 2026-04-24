// MIT License
"use strict";

const japaneseRegExp = /(?:[々〇〻㐀-䶿一-鿿豈-﫿]|[\uD840-\uD87F][\uDC00-\uDFFF]|[ぁ-んァ-ヶ])/;

const englishRegExp = /[a-zA-Z]/;

const defaultOptions = {
    periodMark: ".",
    allowPeriodMarks: [],
    forceAppendPeriod: true
};

function checkEndsWithPeriod(text: any, { periodMarks = [".", "。"] } = {}) {
    const characters = [...text];
    const lastCharacterIndex = characters.length - 1;
    const periodMark = characters[lastCharacterIndex];

    if (/\s/.test(periodMark)) {
        const result = text.match(/\s+$/);
        if (!result) {
            return { valid: false, periodMark: " ", index: lastCharacterIndex - 1 };
        }
        const [whiteSpaces] = result;
        return {
            valid: false,
            periodMark: whiteSpaces,
            index: lastCharacterIndex - (whiteSpaces.length - 1)
        };
    }

    if (/[!?！？)）」』]/.test(periodMark)) {
        return { valid: true, periodMark, index: lastCharacterIndex };
    }

    const matchMark = periodMarks.find((mark) => text.endsWith(mark));
    if (matchMark) {
        return { valid: true, periodMark: matchMark, index: text.length - matchMark.length };
    }

    return { valid: false, periodMark, index: lastCharacterIndex };
}

function isChildNode(node: any, nodeTypes: any, context: any) {
    const { Syntax } = context;
    let current = node.parent;
    while (current) {
        if (nodeTypes.includes(current.type)) {
            return true;
        }
        current = current.parent;
    }
    return false;
}

const reporter = (context: any, options: any = {}) => {
    const { Syntax, RuleError, report, fixer, getSource } = context;
    const preferPeriodMark = options.periodMark || defaultOptions.periodMark;
    const allowPeriodMarks = (options.allowPeriodMarks || defaultOptions.allowPeriodMarks).concat(preferPeriodMark);
    const forceAppendPeriod =
        options.forceAppendPeriod !== undefined ? options.forceAppendPeriod : defaultOptions.forceAppendPeriod;

    const ignoredNodeTypes = [
        Syntax.ListItem,
        Syntax.Link,
        Syntax.Code,
        Syntax.Image,
        Syntax.BlockQuote,
        Syntax.Emphasis,
        Syntax.Header
    ];

    return {
        [Syntax.Paragraph](node: any) {
            if (isChildNode(node, ignoredNodeTypes, context)) {
                return;
            }

            const lastNode = node.children[node.children.length - 1];
            if (lastNode === undefined || lastNode.type !== Syntax.Str) {
                return;
            }

            let lastStrText = getSource(lastNode);
            if (lastStrText.length === 0) {
                return;
            }

            // Trim trailing whitespace for checking, but track it for fix
            const trailingMatch = lastStrText.match(/\s+$/);
            if (trailingMatch) {
                lastStrText = lastStrText.slice(0, -trailingMatch[0].length);
            }

            // Skip paragraphs without English text
            if (!englishRegExp.test(lastStrText)) {
                return;
            }

            // Skip paragraphs with Japanese text (handled by ja-no-mixed-period)
            if (japaneseRegExp.test(lastStrText)) {
                return;
            }

            const { valid, periodMark, index } = checkEndsWithPeriod(lastStrText, {
                periodMarks: allowPeriodMarks
            });

            // DEBUG
            console.error(
                `[DEBUG] text="${lastStrText}" valid=${valid} periodMark="${periodMark}" allowPeriodMarks=${JSON.stringify(
                    allowPeriodMarks
                )}`
            );

            if (valid) {
                return;
            }

            // Trailing whitespace — remove it
            if (/\s/.test(periodMark)) {
                report(
                    lastNode,
                    new RuleError(
                        `Sentence does not end with "${preferPeriodMark}". Trailing whitespace should be removed.`,
                        {
                            index,
                            fix: fixer.replaceTextRange([index, index + periodMark.length], "")
                        }
                    )
                );
                return;
            }

            // Classic period pattern (e.g. "。") — replace with preferred mark
            if (/[。]/.test(periodMark)) {
                report(
                    lastNode,
                    new RuleError(
                        `Sentence does not end with "${preferPeriodMark}". Replace "${periodMark}" with "${preferPeriodMark}".`,
                        {
                            index,
                            fix: fixer.replaceTextRange([index, index + 1], preferPeriodMark)
                        }
                    )
                );
                return;
            }

            // Missing period
            if (forceAppendPeriod) {
                report(
                    lastNode,
                    new RuleError(
                        `Sentence does not end with "${preferPeriodMark}". Add "${preferPeriodMark}" at the end.`,
                        {
                            index: index,
                            fix: fixer.replaceTextRange([index + 1, index + 1], preferPeriodMark)
                        }
                    )
                );
            } else {
                report(
                    lastNode,
                    new RuleError(
                        `Sentence does not end with "${preferPeriodMark}". Add "${preferPeriodMark}" at the end.`,
                        {
                            index: index
                        }
                    )
                );
            }
        }
    };
};

export default {
    linter: reporter,
    fixer: reporter
};
