CREATE TABLE IF NOT EXISTS visited (
	id serial4 NOT NULL,
	url text NULL,
	CONSTRAINT visited_pkey PRIMARY KEY (id),
	CONSTRAINT visited_url_key UNIQUE (url)
);

CREATE TABLE IF NOT EXISTS unvisited (
	id serial4 NOT NULL,
	url text NOT NULL,
	CONSTRAINT unvisited_pkey PRIMARY KEY (id),
	CONSTRAINT unvisited_url_key UNIQUE (url)
);

CREATE TABLE IF NOT EXISTS problem (
	id serial4 NOT NULL,
	url text NULL,
	CONSTRAINT problem_pkey PRIMARY KEY (id),
	CONSTRAINT problem_url_key UNIQUE (url)
);

CREATE TABLE IF NOT EXISTS products (
	id serial4 NOT NULL,
	url text NOT NULL,
	xpath text NULL,
	specifications text NULL,
	description text NULL,
	price text NULL,
	unitofmeasurement text NULL,
	category text NULL,
	brand text NULL,
	sku text NOT NULL,
	"name" text NOT NULL,
	"row" int4 NULL,
	CONSTRAINT products_pkey PRIMARY KEY (id),
	CONSTRAINT products_sku_key UNIQUE (sku),
	CONSTRAINT unique_name_url UNIQUE (name, url)
);


