CREATE TABLE public.app_settings (
  key text NOT NULL,
  value text NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT app_settings_pkey PRIMARY KEY (key)
);
CREATE TABLE public.article_questions (
  id bigint NOT NULL DEFAULT nextval('article_questions_id_seq'::regclass),
  article_id bigint NOT NULL,
  question_text text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  correct_option smallint NOT NULL CHECK (correct_option = ANY (ARRAY[0, 1, 2])),
  CONSTRAINT article_questions_pkey PRIMARY KEY (id),
  CONSTRAINT article_questions_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id)
);
CREATE TABLE public.articles (
  id bigint NOT NULL,
  title text NOT NULL,
  short_text text NOT NULL,
  full_text text NOT NULL,
  image_url text NOT NULL,
  points integer NOT NULL DEFAULT 20,
  is_active boolean NOT NULL DEFAULT true,
  publish_date date,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT articles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.avatar_parts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  category text NOT NULL CHECK (category = ANY (ARRAY['head'::text, 'hair'::text, 'accessory'::text])),
  part_key text NOT NULL,
  url text,
  points_required integer DEFAULT 0,
  display_name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT avatar_parts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.badges (
  badge_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  description text NOT NULL,
  icon_svg_path text NOT NULL,
  unlock_condition character varying NOT NULL,
  points_required integer NOT NULL DEFAULT 0,
  rarity USER-DEFINED NOT NULL DEFAULT 'Common'::rarity_enum,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT badges_pkey PRIMARY KEY (badge_id)
);
CREATE TABLE public.batches (
  batch_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  dropoff_ids ARRAY NOT NULL,
  depot_id text,
  status text NOT NULL DEFAULT 'in_transit_to_depot'::text,
  total_volume numeric NOT NULL,
  departed_at timestamp with time zone DEFAULT now(),
  arrived_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT batches_pkey PRIMARY KEY (batch_id),
  CONSTRAINT batches_depot_id_fkey FOREIGN KEY (depot_id) REFERENCES public.depots(depot_id)
);
CREATE TABLE public.blockchain_ledger (
  index bigint NOT NULL DEFAULT nextval('blockchain_ledger_index_seq'::regclass) UNIQUE,
  timestamp timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id_hashed text NOT NULL,
  payload jsonb NOT NULL,
  previous_hmac text NOT NULL,
  current_hmac text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT blockchain_ledger_pkey PRIMARY KEY (index)
);
CREATE TABLE public.depots (
  depot_id text NOT NULL,
  name text NOT NULL,
  address text,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT depots_pkey PRIMARY KEY (depot_id)
);
CREATE TABLE public.dropoffs (
  dropoff_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  collector_id uuid,
  station_id uuid,
  location USER-DEFINED NOT NULL,
  user_address text,
  estimated_volume numeric NOT NULL,
  actual_volume numeric,
  time_window_start time without time zone,
  time_window_end time without time zone,
  dropoff_type character varying NOT NULL DEFAULT 'station_dropoff'::character varying,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::status_enum,
  qr_code character varying,
  scheduled_for date,
  collected_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone,
  user_lat numeric DEFAULT st_y((location)::geometry),
  user_lon numeric DEFAULT st_x((location)::geometry),
  batch_id uuid,
  depot_id text,
  route_id uuid,
  short_code text,
  CONSTRAINT dropoffs_pkey PRIMARY KEY (dropoff_id),
  CONSTRAINT dropoffs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT dropoffs_collector_id_fkey FOREIGN KEY (collector_id) REFERENCES public.users(user_id),
  CONSTRAINT dropoffs_station_id_fkey FOREIGN KEY (station_id) REFERENCES public.stations(station_id),
  CONSTRAINT dropoffs_depot_id_fkey FOREIGN KEY (depot_id) REFERENCES public.depots(depot_id),
  CONSTRAINT dropoffs_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(route_id)
);
CREATE TABLE public.geojson_upload (
  id bigint NOT NULL DEFAULT nextval('geojson_upload_id_seq'::regclass),
  data jsonb NOT NULL,
  CONSTRAINT geojson_upload_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ledger_references (
  id bigint NOT NULL DEFAULT nextval('ledger_references_id_seq'::regclass),
  ledger_index bigint,
  dropoff_id uuid,
  station_id uuid,
  user_id uuid,
  event_type text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmation_token text,
  CONSTRAINT ledger_references_pkey PRIMARY KEY (id),
  CONSTRAINT ledger_references_ledger_index_fkey FOREIGN KEY (ledger_index) REFERENCES public.blockchain_ledger(index),
  CONSTRAINT ledger_references_dropoff_id_fkey FOREIGN KEY (dropoff_id) REFERENCES public.dropoffs(dropoff_id),
  CONSTRAINT ledger_references_station_id_fkey FOREIGN KEY (station_id) REFERENCES public.stations(station_id),
  CONSTRAINT ledger_references_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.otp_codes (
  id bigint NOT NULL DEFAULT nextval('otp_codes_id_seq'::regclass),
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  consumed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT otp_codes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.routes (
  route_id uuid NOT NULL DEFAULT gen_random_uuid(),
  collector_id uuid NOT NULL,
  route_date date NOT NULL,
  estimated_duration_min integer NOT NULL,
  stops jsonb DEFAULT '[]'::jsonb,
  total_distance_km numeric NOT NULL,
  total_volume_collected numeric,
  status USER-DEFINED NOT NULL DEFAULT 'planned'::status_enum,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone,
  depot_transfer_confirmed boolean DEFAULT false,
  depot_transfer_time timestamp with time zone,
  depot_transfer_volume numeric,
  CONSTRAINT routes_pkey PRIMARY KEY (route_id),
  CONSTRAINT routes_collector_id_fkey FOREIGN KEY (collector_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.states (
  id bigint NOT NULL DEFAULT nextval('states_id_seq'::regclass),
  state_code text,
  state_name text,
  geom USER-DEFINED,
  props jsonb,
  CONSTRAINT states_pkey PRIMARY KEY (id)
);
CREATE TABLE public.states_clean (
  state_name text,
  geom USER-DEFINED,
  city text UNIQUE
);
CREATE TABLE public.stations (
  station_id uuid NOT NULL DEFAULT gen_random_uuid(),
  station_operator_id uuid,
  name character varying NOT NULL,
  address text NOT NULL,
  location USER-DEFINED NOT NULL,
  qr_code character varying NOT NULL,
  capacity_litres integer NOT NULL,
  current_level_litres numeric NOT NULL DEFAULT 0,
  status USER-DEFINED NOT NULL DEFAULT 'active'::status_enum,
  state character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone,
  station_code text UNIQUE,
  CONSTRAINT stations_pkey PRIMARY KEY (station_id),
  CONSTRAINT stations_station_operator_id_fkey FOREIGN KEY (station_operator_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.user_badges (
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL,
  unlocked_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_equipped boolean NOT NULL DEFAULT false,
  CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(badge_id)
);
CREATE TABLE public.users (
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'user'::user_role_enum,
  name character varying NOT NULL,
  phone character varying,
  points integer NOT NULL DEFAULT 0,
  avatar_id uuid,
  theme character varying NOT NULL DEFAULT 'default'::character varying,
  must_change_password boolean NOT NULL DEFAULT false,
  user_address text,
  user_lat numeric,
  user_lon numeric,
  state_assigned character varying,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone,
  last_login timestamp with time zone,
  avatar_head text DEFAULT 'light'::text,
  avatar_hair text DEFAULT 'none'::text,
  avatar_accessory text DEFAULT 'none'::text,
  unlocked_hairs ARRAY DEFAULT ARRAY['none'::text, 'bob'::text, 'curlyBob'::text, 'long'::text],
  unlocked_accessories ARRAY DEFAULT ARRAY['none'::text, 'glasses'::text, 'hat'::text, 'hijab'::text],
  quizzes_completed integer DEFAULT 0,
  completed_quiz_ids ARRAY DEFAULT ARRAY[]::integer[],
  depot_id text,
  lifetime_points integer DEFAULT 0,
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.vehicles (
  vehicle_id uuid NOT NULL DEFAULT gen_random_uuid(),
  driver_id uuid,
  capacity_litres numeric NOT NULL,
  license_plate character varying NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'available'::status_enum,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone,
  CONSTRAINT vehicles_pkey PRIMARY KEY (vehicle_id),
  CONSTRAINT vehicles_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(user_id)
);