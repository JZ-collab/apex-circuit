extends Node3D

## Apex Circuit Native - game orchestration, state machine, camera and AI.

const CARS := [
	{"path": "res://assets/models/concept-038.glb", "name": "CONCEPT 038", "author": "Unity Fan youtube channel", "license_name": "Free Standard / author declares CC0"},
	{"path": "res://assets/models/concept-037.glb", "name": "CONCEPT 037", "author": "Unity Fan youtube channel", "license_name": "Free Standard / author declares CC0"},
	{"path": "res://assets/models/vintage-racer.glb", "name": "VINTAGE RACER", "author": "SpatialNeglect", "license_name": "CC Attribution 4.0"},
	{"path": "res://assets/models/v12-goblin.glb", "name": "V12 GOBLIN", "author": "ollitei", "license_name": "CC Attribution 4.0"},
	{"path": "res://assets/models/wyvern.glb", "name": "WYVERN", "author": "NETRUNNER_pl", "license_name": "CC Attribution 4.0"},
	{"path": "res://assets/models/street-car.glb", "name": "STREET CAR", "author": "cuadot.fbx", "license_name": "CC Attribution 4.0"},
]
const PAINTS := [Color(0.10, 0.72, 1.0), Color(1.0, 0.18, 0.32), Color(0.25, 0.95, 0.45), Color(1.0, 0.72, 0.12), Color(0.75, 0.35, 1.0), Color(0.95, 0.95, 0.97)]
const RIM_COLORS := [Color(0.72, 0.76, 0.82), Color(0.95, 0.78, 0.15), Color(0.92, 0.20, 0.22), Color(0.30, 0.90, 0.45), Color(0.50, 0.35, 0.95), Color(0.10, 0.12, 0.15)]
const DECADES := ["STREET", "SPORT", "SLICK"]
const SUSPENSIONS := ["LOW", "STOCK", "RALLY"]
const DRIVES := ["3.20 ECONOMY", "3.70 BALANCED", "4.15 SHORT"]
const DECALS := ["NONE", "WHITE", "RED", "GOLD", "GREEN"]

var track: RaceTrack
var ui: GameUI
var camera: Camera3D
var player: RaceCar
var rivals: Array[RaceCar] = []
var stuck_timers: Array[float] = []
var player_stuck := 0.0
var state := "MENU"
var selected_model := 0
var selected_paint := 0
var selected_engine := 1
var selected_rim_color := 0
var selected_rim_style := 0
var selected_spoiler := false
var selected_suspension := 1
var selected_tire := 1
var selected_drive := 1
var selected_decal := 0
var time_trial := false
var countdown := 0.0
var race_time := 0.0
var lap := 1
var last_progress := 0.0
var orbit_angle := 0.0
var camera_shake := 0.0
var camera_mode := 0
var save_file := ConfigFile.new()


func _ready() -> void:
	setup_input()
	track = preload("res://scripts/track.gd").new()
	track.name = "Circuit"
	add_child(track)
	camera = Camera3D.new()
	camera.name = "ChaseCamera"
	camera.fov = 74.0
	camera.near = 0.1
	camera.far = 1200.0
	add_child(camera)
	camera.make_current()
	ui = preload("res://scripts/ui.gd").new()
	ui.name = "UI"
	add_child(ui)
	ui.race_requested.connect(start_race.bind(false))
	ui.time_trial_requested.connect(start_race.bind(true))
	ui.garage_requested.connect(open_garage)
	ui.quit_requested.connect(get_tree().quit)
	ui.model_selected.connect(select_model)
	ui.paint_selected.connect(select_paint)
	ui.engine_selected.connect(select_engine)
	ui.rim_color_selected.connect(select_rim_color)
	ui.rim_style_selected.connect(select_rim_style)
	ui.spoiler_toggled.connect(select_spoiler)
	ui.suspension_selected.connect(select_suspension)
	ui.tire_selected.connect(select_tire)
	ui.drive_selected.connect(select_drive)
	ui.decal_selected.connect(select_decal)
	ui.back_requested.connect(back_to_menu)
	ui.launch_requested.connect(start_race.bind(false))
	load_save()
	spawn_cars()
	apply_selection()
	ui.set_credits(credits_text())
	ui.set_spoiler(selected_spoiler)
	refresh_highlights()
	place_grid()
	ui.show_menu()


func setup_input() -> void:
	add_action("accelerate", [KEY_W, KEY_UP])
	add_action("brake", [KEY_S, KEY_DOWN])
	add_action("left", [KEY_A, KEY_LEFT])
	add_action("right", [KEY_D, KEY_RIGHT])
	add_action("nitro", [KEY_SHIFT])
	add_action("camera", [KEY_C])
	add_action("restart", [KEY_R])
	add_action("pause", [KEY_ESCAPE, KEY_P])


func add_action(action: String, keys: Array[int]) -> void:
	if !InputMap.has_action(action):
		InputMap.add_action(action)
	for key in keys:
		var event := InputEventKey.new()
		event.keycode = key
		InputMap.action_add_event(action, event)


func load_save() -> void:
	var err := save_file.load("user://apex_native.cfg")
	if err != OK:
		return
	selected_model = clampi(int(save_file.get_value("garage", "model", 0)), 0, CARS.size() - 1)
	selected_paint = clampi(int(save_file.get_value("garage", "paint", 0)), 0, PAINTS.size() - 1)
	selected_engine = clampi(int(save_file.get_value("garage", "engine", 1)), 0, 3)
	selected_rim_color = clampi(int(save_file.get_value("garage", "rim_color", 0)), 0, RIM_COLORS.size() - 1)
	selected_rim_style = clampi(int(save_file.get_value("garage", "rim_style", 0)), 0, 3)
	selected_spoiler = bool(save_file.get_value("garage", "spoiler", false))
	selected_suspension = clampi(int(save_file.get_value("garage", "suspension", 1)), 0, SUSPENSIONS.size() - 1)
	selected_tire = clampi(int(save_file.get_value("garage", "tire", 1)), 0, DECADES.size() - 1)
	selected_drive = clampi(int(save_file.get_value("garage", "drive", 1)), 0, DRIVES.size() - 1)
	selected_decal = clampi(int(save_file.get_value("garage", "decal", 0)), 0, DECALS.size() - 1)


func save_selection() -> void:
	save_file.set_value("garage", "model", selected_model)
	save_file.set_value("garage", "paint", selected_paint)
	save_file.set_value("garage", "engine", selected_engine)
	save_file.set_value("garage", "rim_color", selected_rim_color)
	save_file.set_value("garage", "rim_style", selected_rim_style)
	save_file.set_value("garage", "spoiler", selected_spoiler)
	save_file.set_value("garage", "suspension", selected_suspension)
	save_file.set_value("garage", "tire", selected_tire)
	save_file.set_value("garage", "drive", selected_drive)
	save_file.set_value("garage", "decal", selected_decal)
	save_file.save("user://apex_native.cfg")


func make_car(index: int) -> RaceCar:
	var data: Dictionary = CARS[index % CARS.size()]
	var car := preload("res://scripts/car.gd").new()
	car.model_path = data.path
	car.display_name = data.name
	car.author = data.author
	car.license_name = data.license_name
	car.name = "Car_%d" % index
	add_child(car)
	return car


func spawn_cars() -> void:
	player = make_car(selected_model)
	for i in 3:
		rivals.append(make_car(i + 1))
		stuck_timers.append(0.0)


func apply_selection() -> void:
	var selected: Dictionary = CARS[selected_model]
	player.display_name = selected.name
	player.author = selected.author
	player.license_name = selected.license_name
	player.set_model(selected.path)
	player.apply_paint(PAINTS[selected_paint])
	player.apply_rims(RIM_COLORS[selected_rim_color], selected_rim_style)
	player.apply_spoiler(selected_spoiler)
	player.apply_decal(selected_decal)
	player.apply_suspension(selected_suspension)
	player.set_tire(selected_tire)
	player.set_final_drive(selected_drive)
	player.configure(selected_engine)
	for i in rivals.size():
		var data: Dictionary = CARS[(selected_model + i + 1) % CARS.size()]
		rivals[i].display_name = data.name
		rivals[i].author = data.author
		rivals[i].license_name = data.license_name
		rivals[i].set_model(data.path)
		rivals[i].apply_paint(PAINTS[(selected_paint + i + 1) % PAINTS.size()])
		rivals[i].apply_rims(RIM_COLORS[(selected_rim_color + i + 1) % RIM_COLORS.size()], i % 4)
		rivals[i].apply_decal((i + 1) % 5)
		rivals[i].set_tire(2)
		rivals[i].set_final_drive(2)
		rivals[i].configure(2)
	save_selection()
	refresh_highlights()


func credits_text() -> String:
	var lines := ["SKETCHFAB COMMUNITY MODELS"]
	for data in CARS:
		lines.append("%s - %s (%s)" % [data.name, data.author, data.license_name])
	lines.append("Circuit, physics, UI and effects are original to Apex Circuit.")
	return "\n".join(lines)


func select_model(index: int) -> void:
	selected_model = clampi(index, 0, CARS.size() - 1)
	apply_selection()


func select_paint(color: Color) -> void:
	var found := PAINTS.find(color)
	selected_paint = found if found >= 0 else 0
	player.apply_paint(PAINTS[selected_paint])
	save_selection()


func select_engine(index: int) -> void:
	selected_engine = clampi(index, 0, 3)
	player.configure(selected_engine)
	refresh_highlights()
	save_selection()


func select_rim_color(color: Color) -> void:
	var found := RIM_COLORS.find(color)
	selected_rim_color = found if found >= 0 else 0
	player.apply_rims(RIM_COLORS[selected_rim_color], selected_rim_style)
	save_selection()


func select_rim_style(index: int) -> void:
	selected_rim_style = clampi(index, 0, 3)
	player.apply_rims(RIM_COLORS[selected_rim_color], selected_rim_style)
	refresh_highlights()
	save_selection()


func select_spoiler(enabled: bool) -> void:
	selected_spoiler = enabled
	player.apply_spoiler(enabled)
	ui.set_spoiler(enabled)
	save_selection()


func select_suspension(index: int) -> void:
	selected_suspension = clampi(index, 0, SUSPENSIONS.size() - 1)
	player.apply_suspension(selected_suspension)
	refresh_highlights()
	save_selection()


func select_tire(index: int) -> void:
	selected_tire = clampi(index, 0, DECADES.size() - 1)
	player.set_tire(selected_tire)
	refresh_highlights()
	save_selection()


func select_drive(index: int) -> void:
	selected_drive = clampi(index, 0, DRIVES.size() - 1)
	player.set_final_drive(selected_drive)
	refresh_highlights()
	save_selection()


func select_decal(index: int) -> void:
	selected_decal = clampi(index, 0, DECALS.size() - 1)
	player.apply_decal(selected_decal)
	refresh_highlights()
	save_selection()


func refresh_highlights() -> void:
	ui.highlight_model(selected_model)
	ui.highlight_engine(selected_engine)
	ui.highlight_rim_style(selected_rim_style)
	ui.highlight_suspension(selected_suspension)
	ui.highlight_tire(selected_tire)
	ui.highlight_drive(selected_drive)
	ui.highlight_decal(selected_decal)
	ui.set_spoiler(selected_spoiler)
	ui.set_summary("%s  |  %s  |  %s  |  %s  |  %s" % [
		CARS[selected_model].name,
		["STREET", "SPORT", "RACE", "NOS READY"][selected_engine],
		DRIVES[selected_drive],
		DECADES[selected_tire],
		SUSPENSIONS[selected_suspension],
	])


func open_garage() -> void:
	state = "GARAGE"
	ui.show_garage()
	refresh_highlights()


func back_to_menu() -> void:
	state = "MENU"
	ui.show_menu()
	place_grid()


func place_grid() -> void:
	var forward: Vector3 = track.tangents[0]
	# Grid sits just after the start line so the first crossing starts lap 1
	# instead of instantly awarding lap 2.
	player.reset_at(track.grid_slot(0), forward)
	for i in rivals.size():
		rivals[i].reset_at(track.grid_slot(i + 1), forward)
	for car in rivals:
		car.visible = true
	for car in [player] + rivals:
		car.set_physics_process(true)
	player_stuck = 0.0
	for i in stuck_timers.size():
		stuck_timers[i] = 0.0
	last_progress = 0.0
	lap = 1
	race_time = 0.0


func start_race(solo: bool) -> void:
	time_trial = solo
	state = "RACE"
	countdown = 3.2
	race_time = 0.0
	lap = 1
	last_progress = 0.0
	place_grid()
	for car in rivals:
		car.visible = !time_trial
		car.set_physics_process(!time_trial)
	ui.show_race()
	ui.set_countdown("3")


func _physics_process(delta: float) -> void:
	if state == "RACE":
		update_player(delta)
		if !time_trial:
			update_rivals(delta)
		update_race_state(delta)
	elif state == "MENU" or state == "GARAGE":
		player.drive(0.0, 0.0, 0.0, delta)
		for car in rivals:
			car.drive(0.0, 0.0, 0.0, delta)


func update_player(delta: float) -> void:
	if countdown > 0.0:
		player.drive(0.0, 0.0, 0.0, delta)
		return
	var throttle := Input.get_action_strength("accelerate")
	var brake := Input.get_action_strength("brake")
	if Input.is_action_just_pressed("nitro"):
		player.nitro = maxf(player.nitro, 35.0)
	# The custom steering model treats positive as left.
	var steer := Input.get_action_strength("left") - Input.get_action_strength("right")
	player.drive(throttle, brake, steer, delta)
	var idx: int = track.nearest_index(player.global_position)
	var upside_down := player.global_transform.basis.y.dot(Vector3.UP) < 0.35
	var off := (player.global_position - track.points[idx]).dot(track.rights[idx])
	var fallen := player.global_position.y < track.points[idx].y - 6.0
	var stranded := upside_down or fallen or absf(off) > track.half_width(idx) + 8.0
	player_stuck = player_stuck + delta if stranded else 0.0
	if player_stuck > 3.0:
		player.reset_at(track.points[idx] + track.tangents[idx] * 2.0, track.tangents[idx])
		player_stuck = 0.0
	if Input.is_action_just_pressed("restart"):
		place_grid()


func update_rivals(delta: float) -> void:
	for i in rivals.size():
		var car: RaceCar = rivals[i]
		if countdown > 0.0:
			car.drive(0.0, 0.0, 0.0, delta)
			continue
		var idx: int = track.nearest_index(car.global_position)
		var look: int = track.index_ahead(idx, 12.0 + car.speed_kmh * 0.22)
		var lane := -2.7 + float(i % 2) * 5.4
		var target: Vector3 = track.points[look] + track.rights[look] * lane
		var forward := -car.global_transform.basis.z
		var to_target := (target - car.global_position).normalized()
		var angle := forward.signed_angle_to(to_target, Vector3.UP)
		var steer := clampf(angle / 0.42, -1.0, 1.0)
		# Use the track's own curvature instead of the car's heading: a spun
		# car would otherwise see a 180° "corner" and brake forever.
		var curve := track.tangents[idx].angle_to(track.tangents[track.index_ahead(idx, 38.0)])
		var target_speed := clampf(190.0 - curve * 165.0 + float(i) * 6.0, 55.0, 182.0)
		var upside_down := car.global_transform.basis.y.dot(Vector3.UP) < 0.35
		var off := (car.global_position - track.points[idx]).dot(track.rights[idx])
		var fallen := car.global_position.y < track.points[idx].y - 6.0
		var struggling := upside_down or fallen or car.speed_kmh < 9.0 or absf(off) > track.half_width(idx) + 6.0
		if struggling:
			stuck_timers[i] += delta
		else:
			stuck_timers[i] = 0.0
		if stuck_timers[i] > 2.2:
			car.reset_at(track.points[idx] + track.tangents[idx] * 2.0 + track.rights[idx] * lane, track.tangents[idx])
			stuck_timers[i] = 0.0
		if absf(angle) > 1.2:
			target_speed = 74.0
		var throttle := 1.0 if car.speed_kmh < target_speed else 0.12
		var brake := 1.0 if car.speed_kmh > target_speed + 16.0 else 0.0
		car.drive(throttle, brake, steer, delta)


func update_race_state(delta: float) -> void:
	if countdown > 0.0:
		countdown -= delta
		var label := "GO!" if countdown <= 0.0 else str(ceili(countdown))
		ui.set_countdown(label)
		if countdown <= 0.0:
			await get_tree().create_timer(0.8).timeout
			ui.set_countdown("")
		return
	race_time += delta
	var idx: int = track.nearest_index(player.global_position)
	var progress := float(idx) / float(track.SAMPLES)
	if last_progress > 0.82 and progress < 0.18:
		lap += 1
		if lap > 3:
			finish_race()
			return
	last_progress = progress
	var position := 1
	for car in rivals:
		if !time_trial and car_progress(car) > float(lap - 1) + progress:
			position += 1
	ui.update_hud(player, lap, position, 4 if !time_trial else 1, race_time)


func car_progress(car: RaceCar) -> float:
	var idx: int = track.nearest_index(car.global_position)
	var p := float(idx) / float(track.SAMPLES)
	var car_lap := 1
	# Rivals share the player's lap counter for a short arcade race.
	if p < 0.15 and last_progress > 0.82:
		car_lap = lap
	elif p > 0.85 and last_progress < 0.15:
		car_lap = lap - 1
	return float(car_lap - 1) + p


func finish_race() -> void:
	state = "RESULTS"
	var mins := int(race_time) / 60
	var secs := int(race_time) % 60
	var cent := int((race_time - floorf(race_time)) * 100.0)
	var mode := "TIME TRIAL" if time_trial else "GRAND PRIX"
	ui.set_results("%s  //  %02d:%02d.%02d" % [mode, mins, secs, cent])
	ui.show_results()


func _unhandled_input(event: InputEvent) -> void:
	if !(event is InputEventKey) or !event.pressed:
		return
	var key := event as InputEventKey
	if key.keycode == KEY_ENTER and state == "MENU":
		start_race(false)
	elif key.keycode == KEY_G and state == "MENU":
		open_garage()
	elif key.keycode == KEY_C and state == "RACE":
		camera_mode = (camera_mode + 1) % 3
	elif key.keycode == KEY_ESCAPE and (state == "RACE" or state == "GARAGE" or state == "RESULTS"):
		back_to_menu()


func _process(delta: float) -> void:
	update_camera(delta)


func update_camera(delta: float) -> void:
	if player == null:
		return
	if state == "MENU" or state == "GARAGE" or state == "RESULTS":
		orbit_angle += delta * 0.23
		var target := player.global_position + Vector3.UP * 1.0
		var desired := target + Vector3(sin(orbit_angle) * 8.5, 3.4, cos(orbit_angle) * 8.5)
		camera.global_position = camera.global_position.lerp(desired, 1.0 - exp(-delta * 3.0))
		camera.look_at(target)
		camera.fov = 74.0
		return
	var forward := -player.global_transform.basis.z
	var speed_factor := clampf(player.speed_kmh / 240.0, 0.0, 1.0)
	var back := 8.5 + speed_factor * 3.0
	var height := 3.2 + speed_factor * 0.5
	var ahead := 7.0 + speed_factor * 10.0
	if camera_mode == 1:
		back = 4.8 + speed_factor * 1.2
		height = 2.1
		ahead = 11.0
	elif camera_mode == 2:
		back = -0.7
		height = 1.05
		ahead = 24.0
	var desired := player.global_position - forward * back + Vector3.UP * height
	var smoothing := 3.5 if camera_mode == 2 else 7.0
	camera.global_position = camera.global_position.lerp(desired, 1.0 - exp(-delta * smoothing))
	var look := player.global_position + forward * ahead + Vector3.UP * (1.2 if camera_mode == 2 else 1.15)
	camera.look_at(look)
	camera.fov = 82.0 if camera_mode == 2 else 74.0
	camera_shake = lerpf(camera_shake, clampf(player.damage * 0.12, 0.0, 0.08), 0.1)
	if camera_shake > 0.001:
		camera.global_position += Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)) * camera_shake
