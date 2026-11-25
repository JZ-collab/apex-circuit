extends CanvasLayer
class_name GameUI

signal race_requested
signal time_trial_requested
signal garage_requested
signal quit_requested
signal model_selected(index: int)
signal paint_selected(color: Color)
signal engine_selected(index: int)
signal rim_color_selected(color: Color)
signal rim_style_selected(index: int)
signal spoiler_toggled(enabled: bool)
signal suspension_selected(index: int)
signal tire_selected(index: int)
signal drive_selected(index: int)
signal decal_selected(index: int)
signal back_requested
signal launch_requested

var menu: Control
var garage: Control
var hud: Control
var results: Control
var countdown: Label
var speed_label: Label
var gear_label: Label
var rpm_label: Label
var lap_label: Label
var position_label: Label
var time_label: Label
var nitro_label: Label
var credits_label: Label
var summary_label: Label
var result_label: Label
var spoiler_button: Button
var model_buttons: Array[Button] = []
var engine_buttons: Array[Button] = []
var rim_style_buttons: Array[Button] = []
var suspension_buttons: Array[Button] = []
var tire_buttons: Array[Button] = []
var drive_buttons: Array[Button] = []
var decal_buttons: Array[Button] = []
var spoiler_enabled := false

const CYAN := Color(0.20, 0.88, 1.0)
const PINK := Color(1.0, 0.25, 0.62)
const DARK := Color(0.02, 0.03, 0.06, 0.88)
const MUTED := Color(0.45, 0.60, 0.75)


func _ready() -> void:
	layer = 10
	build_menu()
	build_garage()
	build_hud()
	build_results()
	countdown = make_label("", 76, Color.WHITE)
	countdown.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	countdown.set_anchors_preset(Control.PRESET_CENTER)
	countdown.position = Vector2(-300, -80)
	countdown.size = Vector2(600, 160)
	add_child(countdown)
	countdown.visible = false
	show_menu()


func panel(color := DARK) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = color
	sb.border_color = Color(0.15, 0.85, 1.0, 0.55)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(14)
	sb.set_content_margin_all(20)
	p.add_theme_stylebox_override("panel", sb)
	return p


func make_label(text: String, size := 24, color := Color.WHITE) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func make_button(text: String, callback: Callable, width := 260, color := CYAN) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(width, 40)
	b.add_theme_font_size_override("font_size", 18)
	b.add_theme_color_override("font_color", Color.WHITE)
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(color.r * 0.16, color.g * 0.16, color.b * 0.16, 0.95)
	normal.border_color = color
	normal.set_border_width_all(2)
	normal.set_corner_radius_all(8)
	var hover := normal.duplicate()
	hover.bg_color = Color(color.r * 0.32, color.g * 0.32, color.b * 0.32, 1.0)
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("pressed", hover)
	b.pressed.connect(callback)
	return b


func section(text: String) -> Label:
	var l := make_label(text, 17, PINK)
	l.custom_minimum_size = Vector2(0, 22)
	return l


func _emit_model(index: int) -> void:
	model_selected.emit(index)


func _emit_paint(color: Color) -> void:
	paint_selected.emit(color)


func _emit_engine(index: int) -> void:
	engine_selected.emit(index)


func _emit_rim_color(color: Color) -> void:
	rim_color_selected.emit(color)


func _emit_rim_style(index: int) -> void:
	rim_style_selected.emit(index)


func _emit_suspension(index: int) -> void:
	suspension_selected.emit(index)


func _emit_tire(index: int) -> void:
	tire_selected.emit(index)


func _emit_drive(index: int) -> void:
	drive_selected.emit(index)


func _emit_decal(index: int) -> void:
	decal_selected.emit(index)


func _toggle_spoiler() -> void:
	spoiler_enabled = !spoiler_enabled
	spoiler_button.text = "SPOILER  %s" % ("ON" if spoiler_enabled else "OFF")
	spoiler_button.modulate = CYAN if spoiler_enabled else Color.WHITE
	spoiler_toggled.emit(spoiler_enabled)


func build_menu() -> void:
	var p := panel(Color(0.02, 0.04, 0.08, 0.86))
	p.set_anchors_preset(Control.PRESET_CENTER)
	p.position = Vector2(-290, -270)
	p.size = Vector2(580, 540)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 14)
	p.add_child(v)
	var title := make_label("APEX CIRCUIT", 58, CYAN)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(title)
	var sub := make_label("NATIVE EDITION  //  SKETCHFAB CARS", 17, PINK)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(sub)
	var desc := make_label("Procedural mountain circuit. Real physics.\nSix community-created 3D cars.", 18, Color(0.78, 0.85, 0.92))
	desc.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(desc)
	v.add_child(make_button("GRAND PRIX", race_requested.emit, 500, CYAN))
	v.add_child(make_button("TIME TRIAL", time_trial_requested.emit, 500, PINK))
	v.add_child(make_button("GARAGE / CUSTOMIZE", garage_requested.emit, 500))
	v.add_child(make_button("QUIT", quit_requested.emit, 500, Color(0.9, 0.5, 0.3)))
	add_child(p)
	menu = p


func build_garage() -> void:
	var p := panel(Color(0.02, 0.04, 0.08, 0.95))
	p.set_anchors_preset(Control.PRESET_CENTER)
	p.position = Vector2(-640, -435)
	p.size = Vector2(1280, 870)
	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	p.add_child(scroll)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 7)
	scroll.add_child(v)
	v.add_child(make_label("GARAGE", 40, CYAN))
	var models := ["CONCEPT 038", "CONCEPT 037", "VINTAGE RACER", "V12 GOBLIN", "WYVERN", "STREET CAR"]
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	for i in models.size():
		var b := make_button(models[i], Callable(self, "_emit_model").bind(i), 188, CYAN if i == 0 else MUTED)
		b.add_theme_font_size_override("font_size", 14)
		model_buttons.append(b)
		row.add_child(b)
	v.add_child(row)

	v.add_child(section("PAINT"))
	var paints := HBoxContainer.new()
	for c in [Color(0.10, 0.72, 1.0), Color(1.0, 0.18, 0.32), Color(0.25, 0.95, 0.45), Color(1.0, 0.72, 0.12), Color(0.75, 0.35, 1.0), Color(0.95, 0.95, 0.97)]:
		var b := make_button("■", Callable(self, "_emit_paint").bind(c), 56, c)
		b.add_theme_font_size_override("font_size", 24)
		paints.add_child(b)
	v.add_child(paints)

	v.add_child(section("RIM COLOUR"))
	var rims := HBoxContainer.new()
	for c in [Color(0.72, 0.76, 0.82), Color(0.95, 0.78, 0.15), Color(0.92, 0.20, 0.22), Color(0.30, 0.90, 0.45), Color(0.50, 0.35, 0.95), Color(0.10, 0.12, 0.15)]:
		var b := make_button("■", Callable(self, "_emit_rim_color").bind(c), 48, c)
		b.add_theme_font_size_override("font_size", 22)
		rims.add_child(b)
	v.add_child(rims)
	v.add_child(section("RIM STYLE"))
	var rim_styles := HBoxContainer.new()
	var style_names := ["CLASSIC", "TURBINE", "MESH", "WIDE"]
	for i in style_names.size():
		var b := make_button(style_names[i], Callable(self, "_emit_rim_style").bind(i), 250, CYAN if i == 0 else MUTED)
		b.add_theme_font_size_override("font_size", 15)
		rim_style_buttons.append(b)
		rim_styles.add_child(b)
	v.add_child(rim_styles)

	v.add_child(section("ENGINE SWAP"))
	var engines := HBoxContainer.new()
	var engine_names := ["STREET", "SPORT", "RACE", "NOS READY"]
	for i in engine_names.size():
		var b := make_button(engine_names[i], Callable(self, "_emit_engine").bind(i), 250, CYAN if i == 1 else MUTED)
		b.add_theme_font_size_override("font_size", 16)
		engine_buttons.append(b)
		engines.add_child(b)
	v.add_child(engines)

	v.add_child(section("FINAL DRIVE"))
	var drives := HBoxContainer.new()
	var drive_names := ["ECONOMY 3.20", "BALANCED 3.70", "SHORT 4.15"]
	for i in drive_names.size():
		var b := make_button(drive_names[i], Callable(self, "_emit_drive").bind(i), 330, CYAN if i == 1 else MUTED)
		b.add_theme_font_size_override("font_size", 15)
		drive_buttons.append(b)
		drives.add_child(b)
	v.add_child(drives)

	v.add_child(section("TIRES / SUSPENSION"))
	var handling := HBoxContainer.new()
	var tire_names := ["STREET", "SPORT", "SLICK"]
	for i in tire_names.size():
		var b := make_button(tire_names[i], Callable(self, "_emit_tire").bind(i), 190, CYAN if i == 1 else MUTED)
		b.add_theme_font_size_override("font_size", 15)
		tire_buttons.append(b)
		handling.add_child(b)
	var susp_names := ["LOW", "STOCK", "RALLY"]
	for i in susp_names.size():
		var b := make_button(susp_names[i], Callable(self, "_emit_suspension").bind(i), 190, CYAN if i == 1 else MUTED)
		b.add_theme_font_size_override("font_size", 15)
		suspension_buttons.append(b)
		handling.add_child(b)
	v.add_child(handling)

	v.add_child(section("EXTRAS"))
	var extras := HBoxContainer.new()
	spoiler_button = make_button("SPOILER  OFF", _toggle_spoiler, 240, MUTED)
	extras.add_child(spoiler_button)
	var decal_names := ["NONE", "WHITE", "RED", "GOLD", "GREEN"]
	for i in decal_names.size():
		var b := make_button(decal_names[i], Callable(self, "_emit_decal").bind(i), 155, CYAN if i == 0 else MUTED)
		b.add_theme_font_size_override("font_size", 15)
		decal_buttons.append(b)
		extras.add_child(b)
	v.add_child(extras)

	summary_label = make_label("", 16, Color(0.85, 0.92, 0.98))
	summary_label.custom_minimum_size = Vector2(0, 24)
	v.add_child(summary_label)
	credits_label = make_label("", 13, Color(0.66, 0.74, 0.82))
	credits_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	credits_label.custom_minimum_size = Vector2(1180, 70)
	v.add_child(credits_label)
	var actions := HBoxContainer.new()
	actions.add_child(make_button("BACK", back_requested.emit, 240, Color(0.9, 0.5, 0.3)))
	actions.add_child(make_button("LAUNCH", launch_requested.emit, 240, PINK))
	v.add_child(actions)
	add_child(p)
	garage = p
	garage.visible = false


func build_hud() -> void:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var left := panel(Color(0.01, 0.03, 0.06, 0.74))
	left.anchor_left = 0.0
	left.anchor_top = 0.0
	left.offset_left = 24
	left.offset_top = 24
	left.offset_right = 334
	left.offset_bottom = 234
	var lv := VBoxContainer.new()
	left.add_child(lv)
	speed_label = make_label("000 KM/H", 44, CYAN)
	lv.add_child(speed_label)
	gear_label = make_label("GEAR 1", 24, Color.WHITE)
	lv.add_child(gear_label)
	rpm_label = make_label("RPM 900", 20, Color(0.75, 0.85, 0.92))
	lv.add_child(rpm_label)
	nitro_label = make_label("NOS 100%", 20, PINK)
	lv.add_child(nitro_label)
	root.add_child(left)
	var right := panel(Color(0.01, 0.03, 0.06, 0.74))
	right.anchor_left = 1.0
	right.anchor_right = 1.0
	right.offset_left = -334
	right.offset_right = -24
	right.offset_top = 24
	right.offset_bottom = 194
	var rv := VBoxContainer.new()
	right.add_child(rv)
	lap_label = make_label("LAP 1 / 3", 26, Color.WHITE)
	rv.add_child(lap_label)
	position_label = make_label("POS 1 / 4", 24, CYAN)
	rv.add_child(position_label)
	time_label = make_label("00:00.00", 24, PINK)
	rv.add_child(time_label)
	root.add_child(right)
	add_child(root)
	hud = root
	hud.visible = false


func build_results() -> void:
	var p := panel(Color(0.02, 0.04, 0.08, 0.94))
	p.set_anchors_preset(Control.PRESET_CENTER)
	p.position = Vector2(-300, -210)
	p.size = Vector2(600, 420)
	var v := VBoxContainer.new()
	p.add_child(v)
	var title := make_label("RACE COMPLETE", 40, CYAN)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(title)
	result_label = make_label("", 24, PINK)
	result_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(result_label)
	v.add_child(make_button("RACE AGAIN", race_requested.emit, 500))
	v.add_child(make_button("GARAGE", garage_requested.emit, 500, PINK))
	v.add_child(make_button("MENU", back_requested.emit, 500, Color(0.9, 0.5, 0.3)))
	add_child(p)
	results = p
	results.visible = false


func show_menu() -> void:
	menu.visible = true
	garage.visible = false
	hud.visible = false
	results.visible = false
	countdown.visible = false


func show_garage() -> void:
	menu.visible = false
	garage.visible = true
	hud.visible = false
	results.visible = false
	countdown.visible = false


func show_race() -> void:
	menu.visible = false
	garage.visible = false
	hud.visible = true
	results.visible = false


func show_results() -> void:
	results.visible = true
	hud.visible = false


func set_countdown(text: String) -> void:
	countdown.text = text
	countdown.visible = text != ""


func set_results(text: String) -> void:
	result_label.text = text


func update_hud(car: RaceCar, lap: int, position: int, total: int, elapsed: float) -> void:
	speed_label.text = "%03d KM/H" % int(car.speed_kmh)
	gear_label.text = "R" if car.reverse else "GEAR %d" % car.gear
	rpm_label.text = "RPM %d" % int(car.rpm)
	nitro_label.text = "NOS %d%%" % int(car.nitro)
	lap_label.text = "LAP %d / 3" % lap
	position_label.text = "POS %d / %d" % [position, total]
	var mins := int(elapsed) / 60
	var secs := int(elapsed) % 60
	var cent := int((elapsed - floorf(elapsed)) * 100.0)
	time_label.text = "%02d:%02d.%02d" % [mins, secs, cent]


func set_credits(text: String) -> void:
	credits_label.text = text


func set_summary(text: String) -> void:
	summary_label.text = text


func set_spoiler(enabled: bool) -> void:
	spoiler_enabled = enabled
	spoiler_button.text = "SPOILER  %s" % ("ON" if enabled else "OFF")
	spoiler_button.modulate = CYAN if enabled else Color.WHITE


func _highlight(buttons: Array[Button], index: int) -> void:
	for i in buttons.size():
		buttons[i].modulate = CYAN if i == index else Color.WHITE


func highlight_model(index: int) -> void:
	_highlight(model_buttons, index)


func highlight_engine(index: int) -> void:
	_highlight(engine_buttons, index)


func highlight_rim_style(index: int) -> void:
	_highlight(rim_style_buttons, index)


func highlight_suspension(index: int) -> void:
	_highlight(suspension_buttons, index)


func highlight_tire(index: int) -> void:
	_highlight(tire_buttons, index)


func highlight_drive(index: int) -> void:
	_highlight(drive_buttons, index)


func highlight_decal(index: int) -> void:
	_highlight(decal_buttons, index)
