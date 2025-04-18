/*
  Warnings:

  - The primary key for the `TechnicalIndicators` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `TechnicalIndicators` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "TechnicalIndicators" DROP CONSTRAINT "TechnicalIndicators_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "TechnicalIndicators_pkey" PRIMARY KEY ("id");
