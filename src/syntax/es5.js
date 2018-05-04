'use strict';

var _merge = require('lodash.merge');
var _isString = require('lodash.isstring');
var safeName = require('../safeName');
var safeArray = require('../safeArray');

var DEFAULTS = {
  assignableName: undefined,
  children: safeArray(undefined),
  cyclomatic: 0,
  lloc: 0,
  newScope: undefined,
  dependencies: undefined
};

var operators = function operators(properties) {
  return properties.map(function (property) {
    if (property && typeof property.identifier !== 'undefined') {
      return property;
    }
    return {
      identifier: property
    };
  });
};

var operands = function operands(identifiers) {
  return identifiers.map(function (identifier) {
    return { identifier: identifier };
  });
};

function defineSyntax(spec) {
  var computedSpec = {
    children: safeArray(spec.children),
    operands: operands(safeArray(spec.operands)),
    operators: operators(safeArray(spec.operators))
  };
  return _merge({}, DEFAULTS, spec, computedSpec);
}

var ArrayExpression = function ArrayExpression(settings) {
  return defineSyntax({
    operators: '[]',
    operands: safeName,
    children: 'elements'
  });
};

var AssignmentExpression = function AssignmentExpression(settings) {
  return defineSyntax({
    operators: function operators(node) {
      return node.operator;
    },
    children: ['left', 'right'],
    assignableName: function assignableName(node) {
      if (node.left.type === 'MemberExpression') {
        return safeName(node.left.object) + '.' + node.left.property.name;
      }
      return safeName(node.left.id);
    }
  });
};

var BinaryExpression = function BinaryExpression(settings) {
  return defineSyntax({
    operators: function operators(node) {
      return node.operator;
    },
    children: ['left', 'right']
  });
};

var BlockStatement = function BlockStatement(settings) {
  return defineSyntax({
    children: 'body'
  });
};

var BreakStatement = function BreakStatement(settings) {
  return defineSyntax({
    lloc: 1,
    operators: 'break',
    children: ['label']
  });
};

var amdPathAliases = {};

function dependencyPath(item, fallback) {
  if (item.type === 'Literal') {
    return amdPathAliases[item.value] || item.value;
  }
  return fallback;
}

function processRequire(node) {
  var line = node.loc.start.line;
  var path = '* dynamic dependency *';
  var args = node.arguments;

  if (args.length === 1) {
    return {
      line: line,
      type: 'CommonJS',
      path: dependencyPath(args[0], path)
    };
  }

  if (args.length === 2) {
    var type = 'AMD';

    if (args[0].type === 'ArrayExpression') {
      return args[0].elements.map(function (item) {
        return {
          type: type,
          line: line,
          path: dependencyPath(item, path)
        };
      });
    }

    return {
      type: type,
      line: line,
      path: dependencyPath(args[0], '* dynamic dependencies *')
    };
  }
}

var CallExpression = function CallExpression(settings) {
  return defineSyntax({
    lloc: function lloc(node) {
      return node.callee.type === 'FunctionExpression' ? 1 : 0;
    },
    operators: '()',
    children: ['arguments', 'callee'],
    dependencies: function dependencies(node, clearAliases) {
      if (clearAliases) {
        // TODO: This prohibits async running. Refine by passing in module id as key for amdPathAliases.
        amdPathAliases = {};
      }

      if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
        return processRequire(node);
      }

      if (node.callee.type === 'MemberExpression' && node.callee.object.type === 'Identifier' && node.callee.object.name === 'require' && node.callee.property.type === 'Identifier' && node.callee.property.name === 'config') {
        var args = node.arguments;
        if (args.length === 1 && args[0].type === 'ObjectExpression') {
          args[0].properties.forEach(function (property) {
            if (property.key.type === 'Identifier' && property.key.name === 'paths' && property.value.type === 'ObjectExpression') {
              property.value.properties.forEach(function (alias) {
                if (alias.key.type === 'Identifier' && alias.value.type === 'Literal') {
                  amdPathAliases[alias.key.name] = alias.value.value;
                }
              });
            }
          });
        }
      }
    }
  });
};

var CatchClause = function CatchClause(settings) {
  return defineSyntax({
    lloc: 1,
    cyclomatic: settings.trycatch ? 1 : 0,
    operators: 'catch',
    children: ['param', 'body']
  });
};

var ConditionalExpression = function ConditionalExpression(settings) {
  return defineSyntax({
    cyclomatic: 1,
    operators: ':?',
    children: ['test', 'consequent', 'alternate']
  });
};

var ContinueStatement = function ContinueStatement(settings) {
  return defineSyntax({
    lloc: 1,
    operators: 'continue',
    children: ['label']
  });
};

var DebuggerStatement = function DebuggerStatement(settings) {
  return defineSyntax({});
};

var DoWhileStatement = function DoWhileStatement(settings) {
  return defineSyntax({
    lloc: 2,
    cyclomatic: function cyclomatic(node) {
      return node.test ? 1 : 0;
    },
    operators: 'dowhile',
    children: ['test', 'body']
  });
};

var EmptyStatement = function EmptyStatement(settings) {
  return defineSyntax({});
};

var ExpressionStatement = function ExpressionStatement(settings) {
  return defineSyntax({
    lloc: 1,
    children: ['expression']
  });
};

var ForInStatement = function ForInStatement(settings) {
  return defineSyntax({
    lloc: 1,
    cyclomatic: settings.forin ? 1 : 0,
    operators: 'forin',
    children: ['left', 'right', 'body']
  });
};

var ForStatement = function ForStatement(settings) {
  return defineSyntax({
    lloc: 1,
    cyclomatic: function cyclomatic(node) {
      return node.test ? 1 : 0;
    },
    operators: 'for',
    children: ['init', 'test', 'update', 'body']
  });
};

var FunctionDeclaration = function FunctionDeclaration(settings) {
  return defineSyntax({
    lloc: 1,
    operators: 'function',
    operands: function operands(node) {
      return safeName(node.id);
    },
    children: ['params', 'body'],
    newScope: true
  });
};

var FunctionExpression = function FunctionExpression(settings) {
  return defineSyntax({
    operators: 'function',
    operands: function operands(node) {
      return safeName(node.id);
    },
    children: ['params', 'body'],
    newScope: true
  });
};

var Identifier = function Identifier(settings) {
  return defineSyntax({
    operands: function operands(node) {
      return node.name;
    }
  });
};

var IfStatement = function IfStatement(settings) {
  return defineSyntax({
    lloc: function lloc(node) {
      return node.alternate ? 2 : 1;
    },
    cyclomatic: 1,
    operators: ['if', {
      filter: function filter(node) {
        return !!node.alternate;
      },
      identifier: 'else'
    }],
    children: ['test', 'consequent', 'alternate']
  });
};

var LabeledStatement = function LabeledStatement(settings) {
  return defineSyntax({});
};

var Literal = function Literal(settings) {
  return defineSyntax({
    operands: function operands(node) {
      if (_isString(node.value)) {
        return '"' + node.value + '"';
      }
      return node.value;
    }
  });
};

var LogicalExpression = function LogicalExpression(settings) {
  return defineSyntax({
    cyclomatic: function cyclomatic(node) {
      var isAnd = node.operator === '&&';
      var isOr = node.operator === '||';
      return isAnd || settings.logicalor && isOr ? 1 : 0;
    },
    operators: function operators(node) {
      return node.operator;
    },
    children: ['left', 'right']
  });
};

var MemberExpression = function MemberExpression(settings) {
  return defineSyntax({
    lloc: function lloc(node) {
      var type = node.object.type;
      if (type === 'ObjectExpression' || type === 'ArrayExpression' || type === 'FunctionExpression') {
        return 1;
      }
      return 0;
    },
    operators: '.',
    children: ['object', 'property']
  });
};

var NewExpression = function NewExpression(settings) {
  return defineSyntax({
    lloc: function lloc(node) {
      return node.callee.type === 'FunctionExpression' ? 1 : 0;
    },
    operators: 'new',
    children: ['arguments', 'callee']
  });
};

var ObjectExpression = function ObjectExpression(settings) {
  return defineSyntax({
    operators: '{}',
    operands: safeName,
    children: 'properties'
  });
};

var Property = function Property(settings) {
  return defineSyntax({
    lloc: 1,
    operators: ':',
    children: ['key', 'value'],
    assignableName: function assignableName(node) {
      return safeName(node.key);
    }
  });
};

var ReturnStatement = function ReturnStatement(settings) {
  return defineSyntax({
    lloc: 1,
    operators: 'return',
    children: 'argument'
  });
};

var SequenceExpression = function SequenceExpression(settings) {
  return defineSyntax({ children: 'expressions' });
};

var SwitchCase = function SwitchCase(settings) {
  return defineSyntax({
    lloc: 1,
    cyclomatic: function cyclomatic(node) {
      return settings.switchcase && node.test ? 1 : 0;
    },
    operators: function operators(node) {
      return node.test ? 'case' : 'default';
    },
    children: ['test', 'consequent']
  });
};

var SwitchStatement = function SwitchStatement(settings) {
  return defineSyntax({
    lloc: 1,
    operators: 'switch',
    children: ['discriminant', 'cases']
  });
};

var ThisExpression = function ThisExpression(settings) {
  return defineSyntax({ operands: 'this' });
};
var ThrowStatement = function ThrowStatement(settings) {
  return defineSyntax({
    lloc: 1,
    operators: 'throw',
    children: 'argument'
  });
};

var TryStatement = function TryStatement(settings) {
  return defineSyntax({
    lloc: 1,
    children: ['block', 'handler']
  });
};

var UnaryExpression = function UnaryExpression(settings) {
  return defineSyntax({
    operators: function operators(node) {
      return node.operator + ' (' + (node.prefix ? 'pre' : 'post') + 'fix)';
    },
    children: 'argument'
  });
};

var UpdateExpression = function UpdateExpression(settings) {
  return defineSyntax({
    operators: function operators(node) {
      return node.operator + ' (' + (node.prefix ? 'pre' : 'post') + 'fix)';
    },
    children: 'argument'
  });
};

var VariableDeclaration = function VariableDeclaration(settings) {
  return defineSyntax({
    operators: function operators(node) {
      return node.kind;
    },
    children: 'declarations'
  });
};

var VariableDeclarator = function VariableDeclarator(settings) {
  return defineSyntax({
    lloc: 1,
    operators: {
      filter: function filter(node) {
        return !!node.init;
      },
      identifier: '='
    },
    children: ['id', 'init'],
    assignableName: function assignableName(node) {
      return safeName(node.id);
    }
  });
};

var WhileStatement = function WhileStatement(settings) {
  return defineSyntax({
    lloc: 1,
    cyclomatic: function cyclomatic(node) {
      return node.test ? 1 : 0;
    },
    operators: 'while',
    children: ['test', 'body']
  });
};

var WithStatement = function WithStatement(settings) {
  return defineSyntax({
    lloc: 1,
    operators: 'with',
    children: ['object', 'body']
  });
};

module.exports = {
  ArrayExpression: ArrayExpression,
  AssignmentExpression: AssignmentExpression,
  BinaryExpression: BinaryExpression,
  BlockStatement: BlockStatement,
  BreakStatement: BreakStatement,
  CallExpression: CallExpression,
  CatchClause: CatchClause,
  ConditionalExpression: ConditionalExpression,
  ContinueStatement: ContinueStatement,
  DebuggerStatement: DebuggerStatement,
  DoWhileStatement: DoWhileStatement,
  EmptyStatement: EmptyStatement,
  ExpressionStatement: ExpressionStatement,
  ForInStatement: ForInStatement,
  ForStatement: ForStatement,
  FunctionDeclaration: FunctionDeclaration,
  FunctionExpression: FunctionExpression,
  Identifier: Identifier,
  IfStatement: IfStatement,
  LabeledStatement: LabeledStatement,
  Literal: Literal,
  LogicalExpression: LogicalExpression,
  MemberExpression: MemberExpression,
  NewExpression: NewExpression,
  ObjectExpression: ObjectExpression,
  Property: Property,
  ReturnStatement: ReturnStatement,
  SequenceExpression: SequenceExpression,
  SwitchCase: SwitchCase,
  SwitchStatement: SwitchStatement,
  ThisExpression: ThisExpression,
  ThrowStatement: ThrowStatement,
  TryStatement: TryStatement,
  UnaryExpression: UnaryExpression,
  UpdateExpression: UpdateExpression,
  VariableDeclaration: VariableDeclaration,
  VariableDeclarator: VariableDeclarator,
  WhileStatement: WhileStatement,
  WithStatement: WithStatement
};
