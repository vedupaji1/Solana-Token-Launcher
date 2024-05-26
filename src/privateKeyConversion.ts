import * as bs58 from "bs58";

(async () => {
  let secreteKeyInBase58 = "";
  let secretKeyInUint8Arr: any = [];
  if (secretKeyInUint8Arr.length > 0) {
    console.log(bs58.encode(secretKeyInUint8Arr));
  } else {
    console.log(bs58.decode(secreteKeyInBase58));
  }
})();
