CREATE TABLE "MenuSection" (
    "name" VARCHAR(64) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuSection_pkey" PRIMARY KEY ("name")
);

ALTER TABLE "Drink" ADD COLUMN "menuSection" VARCHAR(64);

ALTER TABLE "Drink"
ADD CONSTRAINT "Drink_menuSection_fkey"
FOREIGN KEY ("menuSection") REFERENCES "MenuSection"("name")
ON DELETE SET NULL ON UPDATE CASCADE;
