-- Keep country labels stable regardless of the language used during entry.
CREATE OR REPLACE FUNCTION public.normalize_dive_country_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normalized text := lower(btrim(NEW.country));
BEGIN
  NEW.country := CASE normalized
    WHEN '印尼' THEN 'Indonesia'
    WHEN '印度尼西亚' THEN 'Indonesia'
    WHEN '印度尼西亞' THEN 'Indonesia'
    WHEN 'indonesia' THEN 'Indonesia'
    WHEN '菲律宾' THEN 'Philippines'
    WHEN '菲律賓' THEN 'Philippines'
    WHEN 'philippines' THEN 'Philippines'
    WHEN '马来西亚' THEN 'Malaysia'
    WHEN '馬來西亞' THEN 'Malaysia'
    WHEN 'malaysia' THEN 'Malaysia'
    WHEN '泰国' THEN 'Thailand'
    WHEN '泰國' THEN 'Thailand'
    WHEN 'thailand' THEN 'Thailand'
    WHEN '日本' THEN 'Japan'
    WHEN 'japan' THEN 'Japan'
    WHEN '中国' THEN 'China'
    WHEN '中國' THEN 'China'
    WHEN 'china' THEN 'China'
    WHEN '越南' THEN 'Vietnam'
    WHEN 'vietnam' THEN 'Vietnam'
    WHEN '新加坡' THEN 'Singapore'
    WHEN 'singapore' THEN 'Singapore'
    WHEN '澳大利亚' THEN 'Australia'
    WHEN '澳大利亞' THEN 'Australia'
    WHEN '澳洲' THEN 'Australia'
    WHEN 'australia' THEN 'Australia'
    WHEN '马尔代夫' THEN 'Maldives'
    WHEN '馬爾代夫' THEN 'Maldives'
    WHEN 'maldives' THEN 'Maldives'
    WHEN '帕劳' THEN 'Palau'
    WHEN '帛琉' THEN 'Palau'
    WHEN 'palau' THEN 'Palau'
    WHEN '埃及' THEN 'Egypt'
    WHEN 'egypt' THEN 'Egypt'
    WHEN '墨西哥' THEN 'Mexico'
    WHEN 'mexico' THEN 'Mexico'
    WHEN '斐济' THEN 'Fiji'
    WHEN '斐濟' THEN 'Fiji'
    WHEN 'fiji' THEN 'Fiji'
    WHEN '美国' THEN 'United States'
    WHEN '美國' THEN 'United States'
    WHEN 'usa' THEN 'United States'
    WHEN 'united states' THEN 'United States'
    WHEN '斯里兰卡' THEN 'Sri Lanka'
    WHEN '斯里蘭卡' THEN 'Sri Lanka'
    WHEN 'sri lanka' THEN 'Sri Lanka'
    WHEN '巴布亚新几内亚' THEN 'Papua New Guinea'
    WHEN '巴布亞新幾內亞' THEN 'Papua New Guinea'
    WHEN 'papua new guinea' THEN 'Papua New Guinea'
    WHEN '东帝汶' THEN 'Timor-Leste'
    WHEN '東帝汶' THEN 'Timor-Leste'
    WHEN 'east timor' THEN 'Timor-Leste'
    WHEN 'timor-leste' THEN 'Timor-Leste'
    WHEN '韩国' THEN 'South Korea'
    WHEN '韓國' THEN 'South Korea'
    WHEN 'south korea' THEN 'South Korea'
    WHEN '台湾' THEN 'Taiwan'
    WHEN '台灣' THEN 'Taiwan'
    WHEN 'taiwan' THEN 'Taiwan'
    ELSE btrim(NEW.country)
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dives_normalize_country_name ON public.dives;
CREATE TRIGGER dives_normalize_country_name
BEFORE INSERT OR UPDATE OF country ON public.dives
FOR EACH ROW EXECUTE FUNCTION public.normalize_dive_country_name();

-- Run every existing row through the trigger so current map duplicates merge.
UPDATE public.dives SET country = country;
