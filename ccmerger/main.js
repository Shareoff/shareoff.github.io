form = document.getElementById("form")
add_button_section = document.getElementById("add-button-section")
debug = document.getElementById("debug")
button_open = false
json_input = form.elements["jsoninput"]
spritesheet_input = form.elements["pnginput"]
cc_list = document.getElementById("cc-list")
no_ccs = document.getElementById("no-ccs")
cc_summary_section = document.getElementById("summary")
cc_summary = document.getElementById("cc-summary")

// Stolen from colon's syncopation cueing tool cause I'm lazy, thanks colon!
function removeTrailingCommas(json_text) {
    return json_text
    .replace(/,(\s+)},/g, "$1},")
    .replace(/},(\n?\s+")/g, "},$1")   //    }, "
    .replace(/,(\n?\s+])/g, "$1")     //    ", ["
}

class JSONHandler {
	constructor(jsonfile, onLoadedCallback) {
		this.json = jsonfile
		this.contents = null
		this.loaded = false
		this.onLoadedCallback = onLoadedCallback

		this.parseJSON()
	}
	parseJSON() {
		let reader = new FileReader()
		reader.readAsText(this.json)
		let handler = this

		reader.onload = function() {
			try {
				handler.contents = JSON.parse(removeTrailingCommas(reader.result))
				handler.loaded = true
			} catch (e) {
				// this is kinda funny but I guess loaded = false and then just check it in the callback?
				console.log(e)
			}
			handler.onLoadedCallback()
		}
	}

	get size() {
		return this.contents["size"]
	}

	get expressions() {
		return this.contents["clips"]
	}

	get name() {
		return this.json.name
	}

	hasExpression(expr_name) {
		this.expressions.forEach(function(expr) {
			if (expr["name"] == expr_name) {
				return true
			}
		})

		return false
	}
}

class SpritesheetHandler {
	constructor (spritesheet_file, onLoadedCallback) {
		this.file = spritesheet_file
		this.img = new Image();
		this.onLoadedCallback = onLoadedCallback
		this.loaded = false

		this.loadSpritesheet()
	}

	loadSpritesheet() {
		let reader = new FileReader()
		reader.readAsDataURL(this.file)
		let handler = this

		reader.onload = function() {
			handler.img.src = reader.result;
		}

		this.img.onload = function() {
			handler.loaded = true
			handler.onLoadedCallback()
		}
	}

	get width() {
		return this.img.width
	}

	get height() {
		return this.img.height
	}
}

function getCCNameFromPath(full_path) {
	 return full_path.split('\\').pop().split('/').pop().split('.')[0];
}

class CustomCharacter {
	constructor(json, spritesheet, prefix) {
		this.json = json
		this.spritesheet = spritesheet
		this.prefix = prefix
		this.name = getCCNameFromPath(json.name)
	}

	get x_frame_size() {
		return this.json.size[0]
	}

	get y_frame_size() {
		return this.json.size[1]
	}

	get num_expr() {
		return this.json.expressions.length
	}

	get num_frames() {
		return (this.spritesheet.height / this.y_frame_size) * (this.spritesheet.width / this.x_frame_size)
	}
}

curr_json = null
curr_spritesheet = null

function validateMatchingFilenames() {
	if (json_input.value != "" && spritesheet_input.value != "" && getCCNameFromPath(json_input.value) != getCCNameFromPath(spritesheet_input.value)) {
		spritesheet_input.setCustomValidity("The .json and spritesheet .png filenames do not match!")
	} else {
		spritesheet_input.setCustomValidity('')
	}
}

function validateLoadedSpritesheet() {
	if (!spritesheet_input.validity.valid) {
		return
	}

	if (!curr_json.loaded) {
		spritesheet_input.setCustomValidity("Please insert a JSON file first!")
	}

	if (curr_spritesheet.width % curr_json.size[0] != 0 || curr_spritesheet.height % curr_json.size[1] != 0) {
		spritesheet_input.setCustomValidity("Spritesheet dimensions do not match the frame info from the json")
	}


}

function validateLoadedJson() {
	if (!curr_json.loaded) {
		json_input.setCustomValidity("Error parsing .json (this .json appears to be malformed)")
	} else if (!curr_json.size || !curr_json.expressions) {
		json_input.setCustomValidity("This does not appear to be a valid .json representing a custom character!")
	} else {
		json_input.setCustomValidity("")
	}
}

spritesheet_input.addEventListener('change', (event) => {
	validateMatchingFilenames()
	curr_spritesheet = new SpritesheetHandler(spritesheet_input.files[0], validateLoadedSpritesheet)
})

json_input.addEventListener('change', (event) => {
	validateMatchingFilenames()
	curr_json = new JSONHandler(json_input.files[0], validateLoadedJson)
})


characters = []
class Estimate {
	constructor() {
		this.reset()
	}

	reset() {
		this.max_x = 0
		this.max_y = 0
		this.num_expressions = 0
		this.num_frames = 0
	}

	framesPerRowColumn() {
		return Math.ceil(Math.sqrt(this.num_frames))
	}

	get frames_per_column() {
		return this.framesPerRowColumn()
	}

	get frames_per_row() {
		return this.framesPerRowColumn()
	}

	get total_x() {
		return this.max_x * this.frames_per_row
	}

	get total_y() {
		return this.max_y * this.frames_per_column
	}

	get size_text() {
		return this.total_x + "x" + this.total_y + "px"
	}

	get total_size() {
		return this.total_x * this.total_y
	}

	shouldDisplayWarning() {
		return this.total_size > WARNING_SIZE
	}

	getWarning() {
		VERY_LARGE_NUMBER = 26400 * 26400 // :)
		if (this.total_size > VERY_LARGE_NUMBER) {
			return "What the hell is wrong with you lol your spritesheet is terrifying?? I can't stop you but reconsider your life choices maybe?"
		}

		return "Your spritesheet will end up being a total of "
			   + formatSize(this.total_size) + " pixels. Going over " + formatSize(WARNING_SIZE) + " pixels should be done at your own risk."
	}

	displayEstimate() {
		var warning = ""
		var html_tag_name = "size-text"
		if (this.shouldDisplayWarning()) {
			warning = "<br><span class=\"warning\">WARNING:</span> " + this.getWarning()
			html_tag_name = "warning"
		}
		var summary_string = "If you merge now, you will merge a total of " + characters.length + " ccs.<br>"+
						 	 "Each frame will be " + this.max_x + "x" + this.max_y +
						 	 "px. The final character will have " + this.num_expressions + " expressions and " + this.num_frames + " frames.<br>" +
						 	 "In total, the spritesheet will be <span class=" + html_tag_name + ">" + this.size_text + ".</span>" + warning
		cc_summary.innerHTML = summary_string
		cc_summary_section.style.display = "contents"
	}

	addCC(cc) {
		if (cc.x_frame_size > this.max_x) {
			this.max_x = cc.x_frame_size
		}

		if (cc.y_frame_size > this.max_y) {
			this.max_y = cc.y_frame_size
		}

		this.num_expressions += cc.num_expr
		this.num_frames += cc.num_frames
	}

	addCCAndUpdateEstimate(cc) {
		this.addCC(cc)
		this.displayEstimate()
	}

	removeCCAndUpdateEstimate() {
		this.reset()
		if (characters.length == 0) {
			cc_summary_section.style.display = "none"
			return
		}

		characters.forEach(this.addCC)
		this.displayEstimate()
	}
}

function updateMergeSection() {
	merge_section = document.getElementById("merge-section")
	if (characters.length >= 2) {
		merge_section.style.display = "contents"
	} else {
		merge_section.style.display = "none"
	}
}

let estimateCalc = new Estimate()
function addCC(cc) {
	clone = document.getElementById("cc").content.cloneNode(true)
	cc_line = cc.name
	if (cc.prefix != '') {
		cc_line += " (prefix: " + cc.prefix + ")"
	}
	clone.querySelector("p").innerHTML = cc_line
	cc_list.appendChild(clone)
	no_ccs.style.display = "none"
	characters.push(cc)
	estimateCalc.addCCAndUpdateEstimate(cc)
	updateMergeSection()
}


WARNING_SIZE = 8000 * 8000
function formatSize(size) {
	suffix = ''
	num = size
	if (num > 1000) {
		suffix = 'K'
		num = num / 1000
	}

	if (num > 1000) {
		suffix = 'M'
		num = num / 1000
	}

	return Math.round(num) + suffix
}


BASE_CC_HTML_INDEX = 1 // the first index of a possible cc
function removeCC(e) {
	entry_to_remove = e.target.parentNode
	remove_index = Array.prototype.indexOf.call(cc_list.children, entry_to_remove) - BASE_CC_HTML_INDEX
	entry_to_remove.remove()
	characters.splice(remove_index, 1)
	estimateCalc.removeCCAndUpdateEstimate()
	if (characters.length == 0) {
		no_ccs.style.display = "contents"
	}
	updateMergeSection()
}

function checkDoneLoading() {
	if (!json_input.validity.valid || !png_input.validity.valid) {
		return // do nothing if they're already invalid, don't want to override the existing errors
	}

	if (!curr_json.loaded) {
		// this can technically race, huh... I'm too lazy to fix hopefully it will never happen to anyone
		json_input.setCustomValidity("Not loaded yet, please try again in a few seconds...")
	} else {
		json_input.setCustomValidity("")
	}

	if (!curr_spritesheet.loaded) {
		spritesheet_input.setCustomValidity("Not loaded yet, please try again in a few seconds...") // same as previous
	} else {
		spritesheet_input.setCustomValidity("")
	}
}

function confirmationsOnSubmit() {
	var curr_name = getCCNameFromPath(curr_json.json.name)
	var curr_prefix = form.elements["prefixinput"].value
	characters.forEach(function(cc) {
		if (cc.name == curr_name) {
			if (!window.confirm("You have already added a custom character named " + cc.name + "! Are you sure you want to continue?")) {
				return false
			}
		}

		if (cc.prefix == curr_prefix) {
			text = "You have already added a custom character "
			if (cc.prefix == "") {
				text += "with an empty prefix"
			} else {
				text += "with a prefix of " + cc.prefix
			}
			text += "! This may cause collisions in expression names. Are you sure you want to continue?"
			if (!window.confirm(text)) {
				return false
			}
		}
	})

	return true
}

form.addEventListener('submit', (event) => {
	event.preventDefault()

	if (form.checkValidity() && confirmationsOnSubmit()) {
		cc = new CustomCharacter(curr_json, curr_spritesheet, form.elements["prefixinput"].value)
		curr_json = null
		curr_spritesheet = null
		closeForm()
		form.reset()
		addCC(cc)
	} else {
		form.reportValidity()
	}
})

function clickAddButton() {
	openForm()
}

function openForm() {
	form.style.display = "block"
	button_open = true
	add_button_section.style.display = "none"
}

function closeForm() {
	form.style.display = "none"
	button_open = false
	add_button_section.style.display = "contents"
}

class MergedJSON {
	constructor(frame_width, frame_height) {
		this.json = {"size": [frame_width, frame_height], "clips": []}
		this.current_frame = 0
	}

	get expressions() {
		return this.json["clips"]
	}

	addCCExpressions(expressions, prefix, total_frames) {
		let base_frame = this.current_frame
		var new_expressions = []
		expressions.forEach(function(expression) {
			expression.name = prefix + expression.name
			// todo support portrait offsets?? broken for now sorry idk how this is supposed to work
			expression.frames.forEach(function(frame, index, frames) {
				frames[index] = frame + base_frame
			})

			new_expressions.push(expression)
		})

		this.current_frame += total_frames
		this.json["clips"] = this.expressions.concat(new_expressions)
	}
}

class SpritesheetIterator {
	constructor(width, height, frame_width, frame_height) {
		this.width = width
		this.height = height
		this.frame_width = frame_width
		this.frame_height = frame_height
		this.x_pos = 0
		this.y_pos = 0
	}

	next() {
		if (this.y_pos >= this.height) {
			return null
		}

		var ret = [this.x_pos, this.y_pos]

		this.x_pos += this.frame_width 
		if (this.x_pos >= this.width) {
			this.y_pos += this.frame_height
			this.x_pos = 0
		}

		return ret
	}
}

class MergedSpritesheet {
	constructor(width, height, frame_width, frame_height) {
		this.canvas = document.createElement("CANVAS")
		this.canvas.width = width
		this.canvas.height = height
		this.frame_width = frame_width
		this.frame_height = frame_height
		this.iter = new SpritesheetIterator(width, height, frame_width, frame_height)
	}

	addCCSpritesheet(spritesheet, cc_frame_width, cc_frame_height) {
		let cc_iter = new SpritesheetIterator(spritesheet.width, spritesheet.height, cc_frame_width, cc_frame_height)
		var curr_cc_pos = cc_iter.next()
		var ctx = this.canvas.getContext("2d")
		while (curr_cc_pos != null) {
			var merged_pos = this.iter.next()
			if (merged_pos == null) {
				window.alert("This shouldn't happen :worried: tell Shareoff please?")
			}

			var dx = Math.round(merged_pos[0] + (this.frame_width - cc_frame_width) / 2) // please I don't want to figure out where I was wrong let this work first try
			var dy = Math.round(merged_pos[1] + (this.frame_height - cc_frame_height) / 2)

			ctx.drawImage(spritesheet.img, curr_cc_pos[0], curr_cc_pos[1], cc_frame_width,
						  cc_frame_height, dx, dy, cc_frame_width, cc_frame_height) // please please
			curr_cc_pos = cc_iter.next()
		}
	}
}

function download(name, json, spritesheet) {
	var zip = new JSZip()
	let img_url = spritesheet.toDataURL()
	zip.file(name + ".png", img_url.substr(img_url.indexOf(',')+1), {base64: true})
	zip.file(name + ".json", JSON.stringify(json, null, 4))

	zip.generateAsync({type:"blob"}).then(function (blob) {
		saveAs(blob, name + ".zip")
	})
}

cc_name = document.getElementById("cc-name")
function cleanup() {
	while (cc_list.children.length > BASE_CC_HTML_INDEX) {
		cc_list.removeChild(cc_list.children[BASE_CC_HTML_INDEX])
	}
	characters = []
	estimateCalc.removeCCAndUpdateEstimate()
	no_ccs.style.display = "contents"
	cc_name.value = ""
	updateMergeSection()
}

function merge() {
	if (characters.length < 2) {
		window.alert("Please add at least two characters before attempting to merge.")
		return
	}

	if (cc_name.value == "") {
		window.alert("Please enter a CC name before attempting to merge.")
		return
	}

	if (estimateCalc.shouldDisplayWarning()) {
		var should_continue = window.confirm("Please note: " + estimateCalc.getWarning() + " in such large sizes, some users may not be able to properly load levels containing this CC. Are you sure you want to continue?")
		if (!should_continue) {
			return
		}
	}

	let merged_json = new MergedJSON(estimateCalc.max_x, estimateCalc.max_y)
	let merged_spritesheet = new MergedSpritesheet(estimateCalc.total_x, estimateCalc.total_y, estimateCalc.max_x, estimateCalc.max_y)
	characters.forEach(function(cc) {
		merged_spritesheet.addCCSpritesheet(cc.spritesheet, cc.x_frame_size, cc.y_frame_size)
		merged_json.addCCExpressions(cc.json.expressions, cc.prefix, cc.num_frames)
	})

	download(cc_name.value, merged_json.json, merged_spritesheet.canvas)
	cleanup()
}