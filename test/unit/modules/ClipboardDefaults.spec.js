import TabulatorFull from '../../../src/js/core/TabulatorFull.js';
import pasteParsers from '../../../src/js/modules/Clipboard/defaults/pasteParsers.js';
import pasteActions from '../../../src/js/modules/Clipboard/defaults/pasteActions.js';
import keybindingActions from '../../../src/js/modules/Clipboard/extensions/keybindings/actions.js';

describe('Clipboard defaults', function(){
	let table, clipboard;
	let tableData = [
		{id:1, name:"John", age:20},
		{id:2, name:"Jane", age:25},
		{id:3, name:"Steve", age:30}
	];
	let tableColumns = [
		{title:"ID", field:"id"},
		{title:"Name", field:"name"},
		{title:"Age", field:"age"}
	];

	function buildTable(columns){
		let element = document.createElement("div");

		let built = new TabulatorFull(element, {
			data:tableData,
			columns:columns,
			clipboard:true
		});

		return new Promise(resolve => built.on("tableBuilt", () => resolve(built)));
	}

	beforeEach(async function(){
		table = await buildTable(tableColumns);
		clipboard = table.module("clipboard");
	});

	afterEach(function(){
		table.destroy();
	});

	describe('paste parser "table"', function(){
		function parse(text){
			return pasteParsers.table.call(clipboard, text);
		}

		test('is the default paste parser', function(){
			expect(clipboard.pasteParser).toBe(pasteParsers.table);
		});

		test('maps a header row matched by column title and drops it', function(){
			expect(parse("ID\tName\tAge\n1\tJohn\t20")).toEqual([
				{id:"1", name:"John", age:"20"}
			]);
		});

		test('maps columns in the order of the header row', function(){
			expect(parse("Age\tName\tID\n20\tJohn\t1")).toEqual([
				{id:"1", name:"John", age:"20"}
			]);
		});

		test('maps a header row matched by field when titles do not match', function(){
			expect(parse("id\tname\tage\n2\tJane\t25")).toEqual([
				{id:"2", name:"Jane", age:"25"}
			]);
		});

		test('ignores spaces around header values', function(){
			expect(parse(" ID \tName \t Age\n1\tJohn\t20")).toEqual([
				{id:"1", name:"John", age:"20"}
			]);
		});

		test('matches by field when the columns have no title', async function(){
			let untitled = await buildTable([
				{field:"id"},
				{field:"name"},
				{field:"age"}
			]);

			try{
				expect(pasteParsers.table.call(untitled.module("clipboard"), "id\tname\tage\n3\tSteve\t30")).toEqual([
					{id:"3", name:"Steve", age:"30"}
				]);
			}finally{
				untitled.destroy();
			}
		});

		test('falls back to column order and keeps the first row when no header matches', function(){
			expect(parse("1\tJohn\t20\n2\tJane\t25")).toEqual([
				{id:"1", name:"John", age:"20"},
				{id:"2", name:"Jane", age:"25"}
			]);
		});

		test('treats a header that mixes titles and fields as data', function(){
			expect(parse("ID\tname\tAge\n1\tJohn\t20")).toEqual([
				{id:"ID", name:"name", age:"Age"},
				{id:"1", name:"John", age:"20"}
			]);
		});

		test('treats a header row with an empty cell as data', function(){
			expect(parse("ID\t\tAge\n1\tJohn\t20")).toEqual([
				{id:"ID", name:"", age:"Age"},
				{id:"1", name:"John", age:"20"}
			]);
		});

		test('treats a header row with a whitespace-only cell as data', function(){
			expect(parse("ID\t \tAge\n1\tJohn\t20")).toEqual([
				{id:"ID", name:" ", age:"Age"},
				{id:"1", name:"John", age:"20"}
			]);
		});

		test('ignores cells beyond the last column', function(){
			expect(parse("1\tJohn\t20\t30")).toEqual([
				{id:"1", name:"John", age:"20"}
			]);
		});

		test('returns false for a single cell', function(){
			expect(parse("John")).toBe(false);
		});

		test('returns false for an empty paste', function(){
			expect(parse("")).toBe(false);
		});

		// https://github.com/tabulator-tables/tabulator/issues/4928
		// Rows are split on "\n" only: "\r" stays on the last cell of each row and the
		// trailing line ending adds an empty row. Expected result taken from the issue.
		test.failing('parses rows ending in "\\r\\n" without a stray "\\r" or an empty last row', function(){
			expect(parse("1\tJohn\t20\r\n2\tJane\t25\r\n")).toEqual([
				{id:"1", name:"John", age:"20"},
				{id:"2", name:"Jane", age:"25"}
			]);
		});
	});

	describe('paste actions', function(){
		test('"insert" is the default paste action', function(){
			expect(clipboard.pasteAction).toBe(pasteActions.insert);
		});

		test('"replace" replaces the table data through setData', async function(){
			let spy = jest.spyOn(table, "setData");
			let rows = [{id:1, name:"John", age:20}];

			let result = pasteActions.replace.call(clipboard, rows);

			expect(spy).toHaveBeenCalledWith(rows);
			expect(result).toBe(spy.mock.results[0].value);

			await result;

			expect(table.getData()).toEqual([{id:1, name:"John", age:20}]);
		});

		test('"update" updates matching rows through updateOrAddData', async function(){
			let spy = jest.spyOn(table, "updateOrAddData");
			let rows = [{id:2, age:30}];

			let result = pasteActions.update.call(clipboard, rows);

			expect(spy).toHaveBeenCalledWith(rows);
			expect(result).toBe(spy.mock.results[0].value);

			await result;

			expect(table.getDataCount()).toBe(3);
			expect(table.getRow(2).getData()).toEqual({id:2, name:"Jane", age:30});
		});

		test('"insert" adds rows through addData', async function(){
			let spy = jest.spyOn(table, "addData");
			let rows = [{id:3, name:"Steve", age:30}];

			let result = pasteActions.insert.call(clipboard, rows);

			expect(spy).toHaveBeenCalledWith(rows);
			expect(result).toBe(spy.mock.results[0].value);

			await result;

			expect(table.getDataCount()).toBe(4);
		});
	});

	describe('keybinding action copyToClipboard', function(){
		let copySpy;

		function pressCopy(modifiers){
			table.element.dispatchEvent(new KeyboardEvent("keydown", Object.assign({key:"c", bubbles:true}, modifiers)));
			table.element.dispatchEvent(new KeyboardEvent("keyup", Object.assign({key:"c", bubbles:true}, modifiers)));
		}

		beforeEach(function(){
			copySpy = jest.spyOn(clipboard, "copy").mockImplementation(() => {});
		});

		afterEach(function(){
			copySpy.mockRestore();
		});

		test('ctrl + C copies the table', function(){
			pressCopy({ctrlKey:true});

			expect(copySpy).toHaveBeenCalledTimes(1);
			expect(copySpy).toHaveBeenCalledWith(false, true);
		});

		test('meta + C copies the table', function(){
			pressCopy({metaKey:true});

			expect(copySpy).toHaveBeenCalledTimes(1);
			expect(copySpy).toHaveBeenCalledWith(false, true);
		});

		test('does not copy while a cell is being edited', function(){
			let edit = table.modules.edit;

			edit.currentCell = table.getRow(1).getCell("name")._getSelf();

			try{
				pressCopy({ctrlKey:true});
			}finally{
				edit.currentCell = false;
			}

			expect(copySpy).not.toHaveBeenCalled();

			pressCopy({ctrlKey:true});

			expect(copySpy).toHaveBeenCalledTimes(1);
		});

		test('reports a missing clipboard module instead of copying', function(){
			let consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
			let module = table.modules.clipboard;

			delete table.modules.clipboard;

			try{
				keybindingActions.copyToClipboard.call(table.modules.keybindings, new KeyboardEvent("keydown", {key:"c", ctrlKey:true}));

				expect(consoleSpy).toHaveBeenCalledWith("Tabulator Module Not Installed: clipboard");
				expect(copySpy).not.toHaveBeenCalled();
			}finally{
				table.modules.clipboard = module;
				consoleSpy.mockRestore();
			}
		});
	});
});
