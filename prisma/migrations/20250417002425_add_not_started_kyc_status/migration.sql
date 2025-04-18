-- Create new KYCStatus enum with the NOT_STARTED value
CREATE TYPE "KYCStatus_new" AS ENUM ('NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED');

-- Add a new column with the new enum type
ALTER TABLE "User" ADD COLUMN "kycStatus_new" "KYCStatus_new" NOT NULL DEFAULT 'NOT_STARTED';

-- Update the new column based on the old one's values
UPDATE "User" SET "kycStatus_new" = 
  CASE 
    WHEN "kycStatus" = 'PENDING' THEN 'PENDING'::"KYCStatus_new"
    WHEN "kycStatus" = 'APPROVED' THEN 'APPROVED'::"KYCStatus_new"
    WHEN "kycStatus" = 'REJECTED' THEN 'REJECTED'::"KYCStatus_new"
    ELSE 'NOT_STARTED'::"KYCStatus_new"
  END;

-- Drop the old column
ALTER TABLE "User" DROP COLUMN "kycStatus";

-- Rename the new column to match the old one's name
ALTER TABLE "User" RENAME COLUMN "kycStatus_new" TO "kycStatus";

-- Drop the old enum type
DROP TYPE "KYCStatus";

-- Rename the new enum type to match the old one's name
ALTER TYPE "KYCStatus_new" RENAME TO "KYCStatus";

-- Add the exchangeConnected field
ALTER TABLE "User" ADD COLUMN "exchangeConnected" BOOLEAN NOT NULL DEFAULT false;