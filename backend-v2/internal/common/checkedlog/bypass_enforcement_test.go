package checkedlog

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strconv"
	"strings"
	"testing"
)

type bypassRule struct {
	name string
}

var (
	standardStreamNames = []string{"Stdout", "Stderr"}
	fmtPrintNames       = []string{"Print", "Printf", "Println", "Fprint", "Fprintf", "Fprintln"}
	logPrintNames       = []string{"Print", "Printf", "Println", "Fatal", "Fatalf", "Fatalln", "Panic", "Panicf", "Panicln"}
)

func TestProductionGoFilesDoNotBypassCheckedLogBoundary(t *testing.T) {
	root := repositoryRoot(t)
	allowed := map[string]bool{
		filepath.Join("internal", "common", "checkedlog", "emitter.go"): true,
	}
	var violations []string
	walkRoot := filepath.Join(root, "backend-v2")
	if err := filepath.WalkDir(walkRoot, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return directoryWalkDecision(entry.Name())
		}
		if !isProductionGoFile(path) {
			return nil
		}
		rel, err := filepath.Rel(walkRoot, path)
		if err != nil {
			return err
		}
		if allowed[rel] {
			return nil
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		for _, rule := range matchedBypassRules(string(content)) {
			violations = append(violations, rel+": "+rule.name)
		}
		return nil
	}); err != nil {
		t.Fatalf("walk production files: %v", err)
	}
	if len(violations) > 0 {
		t.Fatalf("unchecked production log emitters: %s", strings.Join(violations, ", "))
	}
}

func TestDirectEmitterBypassRulesMatchOnlyUncheckedEmitters(t *testing.T) {
	tests := []struct {
		name      string
		content   string
		wantRules []string
	}{
		{name: "standard log import", content: "package sample\n\nimport (\n\t\"log\"\n)\n", wantRules: []string{"standard log package import"}},
		{name: "aliased standard log print", content: "package sample\n\nimport l \"log\"\n\nfunc emit() { l.Printf(\"%s\", value) }\n", wantRules: []string{"standard log package import", "standard log print"}},
		{name: "slog import", content: "package sample\n\nimport \"log/slog\"\n", wantRules: []string{"standard slog package import"}},
		{name: "dot imported slog import", content: "package sample\n\nimport . \"log/slog\"\n", wantRules: []string{"standard slog package import"}},
		{name: "aliased fmt print family", content: "package sample\n\nimport f \"fmt\"\nimport \"os\"\n\nfunc emit() { f.Fprintln(os.Stdout, value) }\n", wantRules: []string{"direct fmt print", "direct stdout/stderr"}},
		{name: "dot imported fmt print family", content: "package sample\n\nimport . \"fmt\"\n\nfunc emit() { Printf(\"%s\", value) }\n", wantRules: []string{"direct fmt print"}},
		{name: "rebound fmt print family", content: "package sample\n\nimport \"fmt\"\n\nfunc emit() { emit := fmt.Printf; emit(\"%s\", value) }\n", wantRules: []string{"direct fmt print"}},
		{name: "dot imported rebound fmt print family", content: "package sample\n\nimport . \"fmt\"\n\nfunc emit() { emit := Printf; emit(\"%s\", value) }\n", wantRules: []string{"direct fmt print"}},
		{name: "dot imported os stdout writer", content: "package sample\n\nimport . \"os\"\n\nfunc emit() { _, _ = Stdout.Write([]byte(value)) }\n", wantRules: []string{"direct stdout/stderr"}},
		{name: "dot imported rebound os stdout writer", content: "package sample\n\nimport . \"os\"\n\nfunc emit() { sink := Stdout; _, _ = sink.Write([]byte(value)) }\n", wantRules: []string{"direct stdout/stderr"}},
		{name: "dot imported os stderr writer", content: "package sample\n\nimport . \"os\"\n\nfunc emit() { _, _ = Stderr.WriteString(value) }\n", wantRules: []string{"direct stdout/stderr"}},
		{name: "dot imported rebound os stderr writer", content: "package sample\n\nimport . \"os\"\n\nfunc emit() { sink := Stderr; _, _ = sink.Write([]byte(value)) }\n", wantRules: []string{"direct stdout/stderr"}},
		{name: "dot imported fmt print with dot imported stdout", content: "package sample\n\nimport . \"fmt\"\nimport . \"os\"\n\nfunc emit() { Fprintln(Stdout, value) }\n", wantRules: []string{"direct fmt print", "direct stdout/stderr"}},
		{name: "dot imported fmt print with dot imported stderr", content: "package sample\n\nimport . \"fmt\"\nimport . \"os\"\n\nfunc emit() { Fprintf(Stderr, \"%s\", value) }\n", wantRules: []string{"direct fmt print", "direct stdout/stderr"}},
		{name: "dot imported standard log print", content: "package sample\n\nimport . \"log\"\n\nfunc emit() { Printf(\"%s\", value) }\n", wantRules: []string{"standard log package import", "standard log print"}},
		{name: "dot imported rebound standard log print", content: "package sample\n\nimport . \"log\"\n\nfunc emit() { emit := Printf; emit(\"%s\", value) }\n", wantRules: []string{"standard log package import", "standard log print"}},
		{name: "dot imported fiber logger", content: "package sample\n\nimport . \"github.com/gofiber/fiber/v2/middleware/logger\"\n\nfunc mount() { app.Use(New()) }\n", wantRules: []string{"default fiber request logger"}},
		{name: "dot imported rebound fiber logger", content: "package sample\n\nimport . \"github.com/gofiber/fiber/v2/middleware/logger\"\n\nfunc mount() { makeLogger := New; app.Use(makeLogger()) }\n", wantRules: []string{"default fiber request logger"}},
		{name: "builtin print family", content: "package sample\n\nfunc emit() { println(value) }\n", wantRules: []string{"builtin print"}},
		{name: "production panic", content: "package sample\n\nfunc start() { panic(err) }\n", wantRules: []string{"production panic"}},
		{name: "default fiber logger", content: "package sample\n\nimport fiberlogger \"github.com/gofiber/fiber/v2/middleware/logger\"\n\nfunc mount() { app.Use(fiberlogger.New()) }\n", wantRules: []string{"default fiber request logger"}},
		{name: "rebound default fiber logger", content: "package sample\n\nimport fiberlogger \"github.com/gofiber/fiber/v2/middleware/logger\"\n\nfunc mount() { makeLogger := fiberlogger.New; app.Use(makeLogger()) }\n", wantRules: []string{"default fiber request logger"}},
		{name: "third party logger imports", content: "package sample\n\nimport (\n\t\"go.uber.org/zap\"\n\t\"github.com/rs/zerolog\"\n)\n", wantRules: []string{"zap logger import", "zerolog import"}},
		{name: "dot imported third party logger imports", content: "package sample\n\nimport (\n\t. \"go.uber.org/zap\"\n\t. \"github.com/rs/zerolog\"\n)\n", wantRules: []string{"zap logger import", "zerolog import"}},
		{name: "checked logger use is allowed", content: "package sample\n\nfunc emit() { checkedlog.Infof(\"%s\", value); _ = checkedlog.StdoutWriter() }\n", wantRules: nil},
		{name: "ordinary formatting is allowed", content: "package sample\n\nimport \"fmt\"\n\nfunc describe() string { return fmt.Sprintf(\"%s\", value) }\n", wantRules: nil},
		{name: "rebound ordinary formatting is allowed", content: "package sample\n\nimport \"fmt\"\n\nfunc describe() string { format := fmt.Sprintf; return format(\"%s\", value) }\n", wantRules: nil},
		{name: "rebound ordinary error formatting is allowed", content: "package sample\n\nimport \"fmt\"\n\nfunc describe() error { format := fmt.Errorf; return format(\"%s\", value) }\n", wantRules: nil},
		{name: "dot imported ordinary formatting is allowed", content: "package sample\n\nimport . \"fmt\"\n\nfunc describe() string { return Sprintf(\"%s\", value) }\n", wantRules: nil},
		{name: "dot imported rebound ordinary formatting is allowed", content: "package sample\n\nimport . \"fmt\"\n\nfunc describe() string { format := Sprintf; return format(\"%s\", value) }\n", wantRules: nil},
		{name: "dot imported ordinary error formatting is allowed", content: "package sample\n\nimport . \"fmt\"\n\nfunc describe() error { return Errorf(\"%s\", value) }\n", wantRules: nil},
		{name: "dot imported rebound ordinary error formatting is allowed", content: "package sample\n\nimport . \"fmt\"\n\nfunc describe() error { format := Errorf; return format(\"%s\", value) }\n", wantRules: nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertMatchedBypassRuleNames(t, tt.content, tt.wantRules)
		})
	}
}

func TestStandardLogDotImportUsesWholePackageProhibition(t *testing.T) {
	tests := []struct {
		name         string
		extraImports string
		body         string
		wantRules    []string
	}{
		{name: "import only", wantRules: []string{"standard log package import"}},
		{name: "default logger print", body: "func emit() { Default().Print(value) }\n", wantRules: []string{"standard log package import", "standard log print"}},
		{name: "rebound default logger print", body: "func emit() { logger := Default(); logger.Print(value) }\n", wantRules: []string{"standard log package import", "standard log print"}},
		{name: "constructor logger print", extraImports: "import \"io\"\n", body: "func emit() { logger := New(io.Discard, \"\", 0); logger.Print(value) }\n", wantRules: []string{"standard log package import", "standard log print"}},
		{name: "default function reference", body: "var _ = Default\n", wantRules: []string{"standard log package import"}},
		{name: "constructor function reference", body: "var _ = New\n", wantRules: []string{"standard log package import"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			content := "package sample\n\nimport . \"log\"\n" + tt.extraImports + "\n" + tt.body
			assertMatchedBypassRuleNames(t, content, tt.wantRules)
		})
	}
}

func TestUnsafeEmitterReferenceFamiliesRejectAllConfiguredNames(t *testing.T) {
	for _, name := range fmtPrintNames {
		t.Run("fmt selector reference "+name, func(t *testing.T) {
			content := "package sample\n\nimport \"fmt\"\n\nvar _ = fmt." + name + "\n"
			assertMatchedBypassRuleNames(t, content, []string{"direct fmt print"})
		})
		t.Run("fmt dot reference "+name, func(t *testing.T) {
			content := "package sample\n\nimport . \"fmt\"\n\nvar _ = " + name + "\n"
			assertMatchedBypassRuleNames(t, content, []string{"direct fmt print"})
		})
	}

	for _, name := range logPrintNames {
		t.Run("log selector reference "+name, func(t *testing.T) {
			content := "package sample\n\nimport l \"log\"\n\nvar _ = l." + name + "\n"
			assertMatchedBypassRuleNames(t, content, []string{"standard log package import", "standard log print"})
		})
		t.Run("log dot reference "+name, func(t *testing.T) {
			content := "package sample\n\nimport . \"log\"\n\nvar _ = " + name + "\n"
			assertMatchedBypassRuleNames(t, content, []string{"standard log package import", "standard log print"})
		})
	}

	for _, name := range standardStreamNames {
		t.Run("standard stream selector reference "+name, func(t *testing.T) {
			content := "package sample\n\nimport \"os\"\n\nvar _ = os." + name + "\n"
			assertMatchedBypassRuleNames(t, content, []string{"direct stdout/stderr"})
		})
		t.Run("standard stream dot reference "+name, func(t *testing.T) {
			content := "package sample\n\nimport . \"os\"\n\nvar _ = " + name + "\n"
			assertMatchedBypassRuleNames(t, content, []string{"direct stdout/stderr"})
		})
	}
}

func TestUnsafeLoggerPackageImportsRejectDotImportForms(t *testing.T) {
	tests := []struct {
		name string
		path string
		want string
	}{
		{name: "log", path: "log", want: "standard log package import"},
		{name: "slog", path: "log/slog", want: "standard slog package import"},
		{name: "zap", path: "go.uber.org/zap", want: "zap logger import"},
		{name: "zerolog", path: "github.com/rs/zerolog", want: "zerolog import"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			content := "package sample\n\nimport . \"" + tt.path + "\"\n"
			assertMatchedBypassRuleNames(t, content, []string{tt.want})
		})
	}
}

func assertMatchedBypassRuleNames(t *testing.T, content string, wantRules []string) {
	t.Helper()
	got := matchedBypassRuleNames(content)
	if !slices.Equal(got, wantRules) {
		t.Fatalf("matched rules = %v, want %v", got, wantRules)
	}
}

func matchedBypassRuleNames(content string) []string {
	var names []string
	for _, rule := range matchedBypassRules(content) {
		names = append(names, rule.name)
	}
	return names
}

func matchedBypassRules(content string) []bypassRule {
	fileSet := token.NewFileSet()
	file, err := parser.ParseFile(fileSet, "sample.go", content, 0)
	if err != nil {
		return []bypassRule{{name: "unparseable production go file"}}
	}
	imports := collectImports(file)
	ruleSet := orderedRuleSet{}
	for _, path := range imports.aliases {
		addUnsafeLoggerImportRule(path, &ruleSet)
	}
	for path := range imports.dot {
		addUnsafeDotImportRule(path, &ruleSet)
	}
	ast.Inspect(file, func(node ast.Node) bool {
		switch expr := node.(type) {
		case *ast.CallExpr:
			classifyCall(expr, imports, &ruleSet)
		case *ast.Ident:
			classifyIdentReference(expr, imports, &ruleSet)
		case *ast.SelectorExpr:
			classifySelectorReference(expr, imports, &ruleSet)
			if selectorUsesStandardStream(expr, imports) {
				ruleSet.add("direct stdout/stderr")
			}
		}
		return true
	})
	return ruleSet.rules()
}

func addUnsafeLoggerImportRule(path string, rules *orderedRuleSet) {
	switch path {
	case "log":
		rules.add("standard log package import")
	case "log/slog":
		rules.add("standard slog package import")
	case "go.uber.org/zap":
		rules.add("zap logger import")
	case "github.com/rs/zerolog":
		rules.add("zerolog import")
	}
}

func addUnsafeDotImportRule(path string, rules *orderedRuleSet) {
	switch path {
	case "log":
		rules.add("standard log package import")
	case "log/slog":
		rules.add("standard slog package import")
	case "go.uber.org/zap":
		rules.add("zap logger import")
	case "github.com/rs/zerolog":
		rules.add("zerolog import")
	}
}

type importSet struct {
	aliases map[string]string
	dot     map[string]bool
}

func collectImports(file *ast.File) importSet {
	imports := importSet{
		aliases: make(map[string]string),
		dot:     make(map[string]bool),
	}
	for _, spec := range file.Imports {
		path, err := strconv.Unquote(spec.Path.Value)
		if err != nil {
			continue
		}
		alias := filepath.Base(path)
		if spec.Name != nil {
			alias = spec.Name.Name
		}
		if alias == "." {
			imports.dot[path] = true
			continue
		}
		imports.aliases[alias] = path
	}
	return imports
}

func classifyCall(call *ast.CallExpr, imports importSet, rules *orderedRuleSet) {
	switch fun := call.Fun.(type) {
	case *ast.Ident:
		if imports.dot["fmt"] && isFmtPrint(fun.Name) {
			rules.add("direct fmt print")
		}
		if imports.dot["log"] && isLogPrint(fun.Name) {
			rules.add("standard log print")
		}
		if imports.dot["github.com/gofiber/fiber/v2/middleware/logger"] && fun.Name == "New" {
			rules.add("default fiber request logger")
		}
		if fun.Name == "print" || fun.Name == "println" {
			rules.add("builtin print")
		}
		if fun.Name == "panic" {
			rules.add("production panic")
		}
	case *ast.SelectorExpr:
		path := selectorImportPath(fun, imports)
		if path == "fmt" && isFmtPrint(fun.Sel.Name) {
			rules.add("direct fmt print")
		}
		if path == "log" && isLogPrint(fun.Sel.Name) {
			rules.add("standard log print")
		}
		if path == "github.com/gofiber/fiber/v2/middleware/logger" && fun.Sel.Name == "New" {
			rules.add("default fiber request logger")
		}
	}
	for _, arg := range call.Args {
		if identUsesDotImportedStandardStream(arg, imports) {
			rules.add("direct stdout/stderr")
		}
	}
}

func classifyIdentReference(ident *ast.Ident, imports importSet, rules *orderedRuleSet) {
	if imports.dot["fmt"] && isFmtPrint(ident.Name) {
		rules.add("direct fmt print")
	}
	if imports.dot["log"] && isLogPrint(ident.Name) {
		rules.add("standard log print")
	}
	if imports.dot["github.com/gofiber/fiber/v2/middleware/logger"] && ident.Name == "New" {
		rules.add("default fiber request logger")
	}
	if imports.dot["os"] && isStandardStream(ident.Name) {
		rules.add("direct stdout/stderr")
	}
}

func classifySelectorReference(selector *ast.SelectorExpr, imports importSet, rules *orderedRuleSet) {
	path := selectorImportPath(selector, imports)
	switch {
	case path == "fmt" && isFmtPrint(selector.Sel.Name):
		rules.add("direct fmt print")
	case path == "log" && isLogPrint(selector.Sel.Name):
		rules.add("standard log print")
	case path == "github.com/gofiber/fiber/v2/middleware/logger" && selector.Sel.Name == "New":
		rules.add("default fiber request logger")
	}
}

func selectorImportPath(selector *ast.SelectorExpr, imports importSet) string {
	ident, ok := selector.X.(*ast.Ident)
	if !ok {
		return ""
	}
	return imports.aliases[ident.Name]
}

func selectorUsesStandardStream(selector *ast.SelectorExpr, imports importSet) bool {
	if selectorImportPath(selector, imports) == "os" && isStandardStream(selector.Sel.Name) {
		return true
	}
	return identUsesDotImportedStandardStream(selector.X, imports)
}

func identUsesDotImportedStandardStream(expr ast.Expr, imports importSet) bool {
	ident, ok := expr.(*ast.Ident)
	return ok && imports.dot["os"] && isStandardStream(ident.Name)
}

func isStandardStream(name string) bool {
	return slices.Contains(standardStreamNames, name)
}

func isFmtPrint(name string) bool {
	return slices.Contains(fmtPrintNames, name)
}

func isLogPrint(name string) bool {
	return slices.Contains(logPrintNames, name)
}

type orderedRuleSet struct {
	seen map[string]bool
	list []bypassRule
}

func (s *orderedRuleSet) add(name string) {
	if s.seen == nil {
		s.seen = make(map[string]bool)
	}
	if s.seen[name] {
		return
	}
	s.seen[name] = true
	s.list = append(s.list, bypassRule{name: name})
}

func (s *orderedRuleSet) rules() []bypassRule {
	sort.Slice(s.list, func(left, right int) bool {
		return ruleOrder(s.list[left].name) < ruleOrder(s.list[right].name)
	})
	return s.list
}

func ruleOrder(name string) int {
	order := []string{
		"standard log package import",
		"standard log print",
		"standard slog package import",
		"direct fmt print",
		"direct stdout/stderr",
		"builtin print",
		"production panic",
		"default fiber request logger",
		"zap logger import",
		"zerolog import",
		"unparseable production go file",
	}
	for index, candidate := range order {
		if candidate == name {
			return index
		}
	}
	return len(order)
}

func directoryWalkDecision(name string) error {
	if name == ".git" || name == "e2e" {
		return filepath.SkipDir
	}
	return nil
}

func isProductionGoFile(path string) bool {
	return strings.HasSuffix(path, ".go") && !strings.HasSuffix(path, "_test.go")
}

func repositoryRoot(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("get working directory: %v", err)
	}
	for dir := wd; dir != filepath.Dir(dir); dir = filepath.Dir(dir) {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return filepath.Dir(dir)
		}
	}
	t.Fatal("repository root not found")
	return ""
}
